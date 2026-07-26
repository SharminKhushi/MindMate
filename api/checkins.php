<?php
require 'config.php';
require 'helpers.php';

$userId = requireAuth($conn);
$method = $_SERVER['REQUEST_METHOD'];

/* ---------- GET: all checkins (for charts/streak) ---------- */
if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT checkin_date, mood, stress, energy, sleep, created_at FROM checkins WHERE user_id = ? ORDER BY checkin_date ASC");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $checkins = [];
    while ($row = $result->fetch_assoc()) {
        $checkins[] = [
            'date' => $row['checkin_date'],
            'mood' => $row['mood'],
            'stress' => $row['stress'] !== null ? (int)$row['stress'] : null,
            'energy' => $row['energy'] !== null ? (int)$row['energy'] : null,
            'sleep' => $row['sleep'] !== null ? (float)$row['sleep'] : null,
            'timestamp' => str_replace(' ', 'T', $row['created_at']) . 'Z'
        ];
    }
    echo json_encode($checkins);
    exit;
}

/* ---------- POST: upsert today's (or given date's) check-in ---------- */
if ($method === 'POST') {
    $input = jsonBody();
    $date = $input['date'] ?? todayDate();
    $mood = $input['mood'] ?? null;
    $stress = isset($input['stress']) ? (int)$input['stress'] : null;
    $energy = isset($input['energy']) ? (int)$input['energy'] : null;
    $sleep = isset($input['sleep']) ? (float)$input['sleep'] : null;

    if (!$mood) sendError('Mood is required.');

    $stmt = $conn->prepare("
        INSERT INTO checkins (user_id, checkin_date, mood, stress, energy, sleep)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            mood = VALUES(mood),
            stress = COALESCE(VALUES(stress), stress),
            energy = COALESCE(VALUES(energy), energy),
            sleep = COALESCE(VALUES(sleep), sleep)
    ");
    $stmt->bind_param('ississ', $userId, $date, $mood, $stress, $energy, $sleep);
    $stmt->execute();

    echo json_encode(['success' => true]);
    exit;
}

sendError('Method not allowed', 405);