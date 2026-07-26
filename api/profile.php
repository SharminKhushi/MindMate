<?php
require 'config.php';
require 'helpers.php';

$userId = requireAuth($conn);
$method = $_SERVER['REQUEST_METHOD'];

/* ---------- GET: profile info + quick stats (for a "realistic" profile page) ---------- */
if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT id, name, email, age, avatar, created_at FROM users WHERE id = ?");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    $stats = [];
    foreach (['journal_entries' => 'journalCount', 'goals' => 'goalsCount', 'contacts' => 'contactsCount', 'checkins' => 'checkinCount'] as $table => $key) {
        $s = $conn->prepare("SELECT COUNT(*) as c FROM `$table` WHERE user_id = ?");
        $s->bind_param('i', $userId);
        $s->execute();
        $stats[$key] = (int)$s->get_result()->fetch_assoc()['c'];
    }

    $achStmt = $conn->prepare("SELECT COUNT(*) as c FROM user_achievements WHERE user_id = ?");
    $achStmt->bind_param('i', $userId);
    $achStmt->execute();
    $stats['achievementsCount'] = (int)$achStmt->get_result()->fetch_assoc()['c'];

    // Streak (same logic as challenges.php / achievements.php)
    $logStmt = $conn->prepare("SELECT DISTINCT log_date FROM challenge_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 90");
    $logStmt->bind_param('i', $userId);
    $logStmt->execute();
    $activeSet = array_flip(array_map(fn($r) => $r['log_date'], $logStmt->get_result()->fetch_all(MYSQLI_ASSOC)));

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
    $stats['streak'] = $streak;

    echo json_encode(['user' => $user, 'stats' => $stats]);
    exit;
}

/* ---------- PUT: update name / email / age / avatar ---------- */
if ($method === 'PUT') {
    $input = jsonBody();
    $name = trim($input['name'] ?? '');
    $email = strtolower(trim($input['email'] ?? ''));
    $age = isset($input['age']) ? intval($input['age']) : null;
    $avatar = $input['avatar'] ?? null;

    if (strlen($name) < 2) sendError('Please enter a valid name.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) sendError('Please enter a valid email.');

    $check = $conn->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
    $check->bind_param('si', $email, $userId);
    $check->execute();
    if ($check->get_result()->num_rows > 0) sendError('That email is already used by another account.', 409);

    if ($avatar !== null) {
        $stmt = $conn->prepare("UPDATE users SET name = ?, email = ?, age = ?, avatar = ? WHERE id = ?");
        $stmt->bind_param('ssisi', $name, $email, $age, $avatar, $userId);
    } else {
        $stmt = $conn->prepare("UPDATE users SET name = ?, email = ?, age = ? WHERE id = ?");
        $stmt->bind_param('ssii', $name, $email, $age, $userId);
    }
    $stmt->execute();

    echo json_encode(['success' => true]);
    exit;
}

sendError('Method not allowed', 405);