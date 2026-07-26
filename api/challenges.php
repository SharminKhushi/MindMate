<?php
require 'config.php';
require 'helpers.php';

$userId = requireAuth($conn);
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'list';

/* Default challenges given to every new user (customizable later) */
function ensureDefaultChallenges($conn, $userId) {
    $check = $conn->prepare("SELECT id FROM user_challenge_prefs WHERE user_id = ?");
    $check->bind_param('i', $userId);
    $check->execute();
    if ($check->get_result()->num_rows > 0) return;

    $defaults = [
        ['drink_water', 'Drink Water', 'fa-solid fa-glass-water'],
        ['walk', 'Walk 15 Minutes', 'fa-solid fa-person-walking'],
        ['study', 'Study 30 Minutes', 'fa-solid fa-book'],
        ['meditate', 'Meditate 5 Minutes', 'fa-solid fa-spa']
    ];
    $stmt = $conn->prepare("INSERT INTO user_challenge_prefs (user_id, challenge_key, label, icon, is_active) VALUES (?, ?, ?, ?, 1)");
    foreach ($defaults as $d) {
        $stmt->bind_param('isss', $userId, $d[0], $d[1], $d[2]);
        $stmt->execute();
    }
}

/* Streak with "1 grace day per week" — a missed day doesn't break the streak
   if that week's grace day has been used. */
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
        if (isset($activeSet[$dateKey])) {
            $streak++;
            $cursor->modify('-1 day');
        } elseif (isset($graceWeeks[weekStartDate($dateKey)])) {
            $cursor->modify('-1 day'); // grace day covers this gap, keep going but don't count it
        } else {
            break;
        }
    }
    return $streak;
}

/* ---------- GET ?action=list ---------- */
if ($method === 'GET' && $action === 'list') {
    ensureDefaultChallenges($conn, $userId);

    $stmt = $conn->prepare("SELECT challenge_key, label, icon FROM user_challenge_prefs WHERE user_id = ? AND is_active = 1 ORDER BY id ASC");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $challenges = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $today = todayDate();
    $logStmt = $conn->prepare("SELECT challenge_key FROM challenge_logs WHERE user_id = ? AND log_date = ?");
    $logStmt->bind_param('is', $userId, $today);
    $logStmt->execute();
    $completedToday = array_map(fn($r) => $r['challenge_key'], $logStmt->get_result()->fetch_all(MYSQLI_ASSOC));

    $thisWeek = weekStartDate();
    $graceCheck = $conn->prepare("SELECT id FROM grace_days_used WHERE user_id = ? AND week_start = ?");
    $graceCheck->bind_param('is', $userId, $thisWeek);
    $graceCheck->execute();
    $graceUsedThisWeek = $graceCheck->get_result()->num_rows > 0;

    echo json_encode([
        'challenges' => $challenges,
        'completedToday' => $completedToday,
        'streak' => calculateStreakWithGrace($conn, $userId),
        'graceDayUsedThisWeek' => $graceUsedThisWeek
    ]);
    exit;
}

/* ---------- POST ?action=toggle&key=drink_water ---------- */
if ($method === 'POST' && $action === 'toggle') {
    $key = $_GET['key'] ?? '';
    if (!$key) sendError('Missing challenge key');
    $today = todayDate();

    $existing = $conn->prepare("SELECT id FROM challenge_logs WHERE user_id = ? AND challenge_key = ? AND log_date = ?");
    $existing->bind_param('iss', $userId, $key, $today);
    $existing->execute();

    if ($existing->get_result()->num_rows > 0) {
        $del = $conn->prepare("DELETE FROM challenge_logs WHERE user_id = ? AND challenge_key = ? AND log_date = ?");
        $del->bind_param('iss', $userId, $key, $today);
        $del->execute();
        echo json_encode(['success' => true, 'completed' => false]);
    } else {
        $ins = $conn->prepare("INSERT INTO challenge_logs (user_id, challenge_key, log_date) VALUES (?, ?, ?)");
        $ins->bind_param('iss', $userId, $key, $today);
        $ins->execute();
        echo json_encode(['success' => true, 'completed' => true]);
    }
    exit;
}

/* ---------- PUT ?action=customize — replace user's challenge list ---------- */
if ($method === 'PUT' && $action === 'customize') {
    $input = jsonBody();
    $list = $input['challenges'] ?? [];
    if (empty($list) || count($list) > 6) sendError('Provide between 1 and 6 challenges.');

    $del = $conn->prepare("DELETE FROM user_challenge_prefs WHERE user_id = ?");
    $del->bind_param('i', $userId);
    $del->execute();

    $ins = $conn->prepare("INSERT INTO user_challenge_prefs (user_id, challenge_key, label, icon, is_active) VALUES (?, ?, ?, ?, 1)");
    foreach ($list as $c) {
        $key = preg_replace('/[^a-z0-9_]/', '', strtolower(str_replace(' ', '_', trim($c['label'] ?? ''))));
        $label = trim($c['label'] ?? '');
        $icon = $c['icon'] ?? 'fa-solid fa-star';
        if ($label === '') continue;
        $ins->bind_param('isss', $userId, $key, $label, $icon);
        $ins->execute();
    }
    echo json_encode(['success' => true]);
    exit;
}

/* ---------- POST ?action=use-grace — use this week's grace day ---------- */
if ($method === 'POST' && $action === 'use-grace') {
    $thisWeek = weekStartDate();
    $check = $conn->prepare("SELECT id FROM grace_days_used WHERE user_id = ? AND week_start = ?");
    $check->bind_param('is', $userId, $thisWeek);
    $check->execute();
    if ($check->get_result()->num_rows > 0) sendError('Grace day already used this week.', 409);

    $stmt = $conn->prepare("INSERT INTO grace_days_used (user_id, week_start, used_date) VALUES (?, ?, ?)");
    $today = todayDate();
    $stmt->bind_param('iss', $userId, $thisWeek, $today);
    $stmt->execute();
    echo json_encode(['success' => true]);
    exit;
}

sendError('Unknown action', 400);