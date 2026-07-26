<?php
require 'config.php';
require 'helpers.php';

$userId = requireAuth($conn);

/* ---------- Gather stats needed for badge conditions ---------- */
$journalStmt = $conn->prepare("SELECT COUNT(*) as c FROM journal_entries WHERE user_id = ?");
$journalStmt->bind_param('i', $userId);
$journalStmt->execute();
$journalCount = (int)$journalStmt->get_result()->fetch_assoc()['c'];

$goalStmt = $conn->prepare("SELECT COUNT(*) as c FROM goals WHERE user_id = ?");
$goalStmt->bind_param('i', $userId);
$goalStmt->execute();
$goalCount = (int)$goalStmt->get_result()->fetch_assoc()['c'];

$checkinStmt = $conn->prepare("SELECT COUNT(*) as c FROM checkins WHERE user_id = ?");
$checkinStmt->bind_param('i', $userId);
$checkinStmt->execute();
$checkinCount = (int)$checkinStmt->get_result()->fetch_assoc()['c'];

/* Reuse the same streak logic as challenges.php */
function calculateStreakWithGrace($conn, $userId) {
    $stmt = $conn->prepare("SELECT DISTINCT log_date FROM challenge_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 90");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $activeSet = array_flip(array_map(fn($r) => $r['log_date'], $stmt->get_result()->fetch_all(MYSQLI_ASSOC)));

    $graceStmt = $conn->prepare("SELECT week_start FROM grace_days_used WHERE user_id = ?");
    $graceStmt->bind_param('i', $userId);
    $graceStmt->execute();
    $graceWeeks = array_flip(array_map(fn($r) => $r['week_start'], $graceStmt->get_result()->fetch_all(MYSQLI_ASSOC)));

    $streak = 0;
    $cursor = new DateTime();
    if (!isset($activeSet[$cursor->format('Y-m-d')])) $cursor->modify('-1 day');

    while (true) {
        $dateKey = $cursor->format('Y-m-d');
        if (isset($activeSet[$dateKey])) { $streak++; $cursor->modify('-1 day'); }
        elseif (isset($graceWeeks[weekStartDate($dateKey)])) { $cursor->modify('-1 day'); }
        else break;
    }
    return $streak;
}
$streak = calculateStreakWithGrace($conn, $userId);

/* ---------- Badge definitions (condition + "why it matters" + progress hint) ---------- */
$badges = [
    [
        'key' => 'first_checkin', 'label' => 'First Check-in', 'icon' => 'fa-solid fa-seedling',
        'why' => 'Showing up once is the hardest part — you already did it.',
        'unlocked' => $checkinCount >= 1,
        'hint' => $checkinCount >= 1 ? null : 'Log your first mood check-in to unlock this.'
    ],
    [
        'key' => 'streak_3', 'label' => '3-Day Streak', 'icon' => 'fa-solid fa-fire',
        'why' => 'Consistency, even small, builds real emotional resilience.',
        'unlocked' => $streak >= 3,
        'hint' => $streak >= 3 ? null : (3 - $streak) . ' more day(s) to go — you\'re doing great so far!'
    ],
    [
        'key' => 'streak_7', 'label' => '7-Day Streak', 'icon' => 'fa-solid fa-fire-flame-curved',
        'why' => 'A full week of showing up for yourself — that\'s a real habit forming.',
        'unlocked' => $streak >= 7,
        'hint' => $streak >= 7 ? null : (7 - $streak) . ' more day(s) to go — keep it up!'
    ],
    [
        'key' => 'journal_writer', 'label' => 'First Journal Entry', 'icon' => 'fa-solid fa-pen-nib',
        'why' => 'Putting feelings into words is one of the most effective ways to process them.',
        'unlocked' => $journalCount >= 1,
        'hint' => $journalCount >= 1 ? null : 'Write your first journal entry to unlock this.'
    ],
    [
        'key' => 'goal_setter', 'label' => 'First Goal Set', 'icon' => 'fa-solid fa-bullseye',
        'why' => 'Naming what you want is the first step toward getting there.',
        'unlocked' => $goalCount >= 1,
        'hint' => $goalCount >= 1 ? null : 'Set your first goal to unlock this.'
    ]
];

/* ---------- Persist newly-unlocked badges with a timestamp ---------- */
$response = [];
foreach ($badges as $b) {
    $unlockedAt = null;

    if ($b['unlocked']) {
        $check = $conn->prepare("SELECT unlocked_at FROM user_achievements WHERE user_id = ? AND badge_key = ?");
        $check->bind_param('is', $userId, $b['key']);
        $check->execute();
        $existing = $check->get_result()->fetch_assoc();

        if ($existing) {
            $unlockedAt = $existing['unlocked_at'];
        } else {
            $ins = $conn->prepare("INSERT INTO user_achievements (user_id, badge_key) VALUES (?, ?)");
            $ins->bind_param('is', $userId, $b['key']);
            $ins->execute();
            $unlockedAt = date('Y-m-d H:i:s');
        }
    }

    $response[] = [
        'key' => $b['key'],
        'label' => $b['label'],
        'icon' => $b['icon'],
        'why' => $b['why'],
        'unlocked' => $b['unlocked'],
        'unlockedAt' => $unlockedAt,
        'hint' => $b['hint']
    ];
}

echo json_encode($response);