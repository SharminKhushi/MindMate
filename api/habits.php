<?php
require 'config.php';
require 'helpers.php';

$userId = requireAuth($conn);
$method = $_SERVER['REQUEST_METHOD'];

/* ---------- GET: habits + their completedDates ---------- */
if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT id, title, created_at FROM habits WHERE user_id = ? ORDER BY created_at ASC");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $habits = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $habitList = [];
    foreach ($habits as $h) {
        $logStmt = $conn->prepare("SELECT completed_date FROM habit_logs WHERE habit_id = ? ORDER BY completed_date ASC");
        $logStmt->bind_param('i', $h['id']);
        $logStmt->execute();
        $dates = array_map(fn($r) => $r['completed_date'], $logStmt->get_result()->fetch_all(MYSQLI_ASSOC));

        $habitList[] = [
            'id' => (string)$h['id'],
            'title' => $h['title'],
            'completedDates' => $dates,
            'createdAt' => str_replace(' ', 'T', $h['created_at']) . 'Z'
        ];
    }
    echo json_encode($habitList);
    exit;
}

/* ---------- POST: new habit ---------- */
if ($method === 'POST') {
    $input = jsonBody();
    $title = trim($input['title'] ?? '');
    if ($title === '') sendError('Habit title is required.');

    $stmt = $conn->prepare("INSERT INTO habits (user_id, title) VALUES (?, ?)");
    $stmt->bind_param('is', $userId, $title);
    $stmt->execute();

    echo json_encode(['id' => (string)$conn->insert_id, 'success' => true]);
    exit;
}

/* ---------- PUT: edit title ---------- */
if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) sendError('Missing habit id');
    $input = jsonBody();
    $title = trim($input['title'] ?? '');
    if ($title === '') sendError('Habit title is required.');

    $stmt = $conn->prepare("UPDATE habits SET title = ? WHERE id = ? AND user_id = ?");
    $stmt->bind_param('sii', $title, $id, $userId);
    $stmt->execute();

    if ($stmt->affected_rows === 0) sendError('Habit not found', 404);
    echo json_encode(['success' => true]);
    exit;
}

/* ---------- POST /habits.php?action=toggle&id=X: toggle today's completion ---------- */
if ($method === 'POST' && ($_GET['action'] ?? '') === 'toggle') {
    // (handled above already covers POST — this block is unreachable; use dedicated route instead)
}

/* ---------- DELETE: remove habit ---------- */
if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) sendError('Missing habit id');

    // Verify ownership before delete
    $check = $conn->prepare("SELECT id FROM habits WHERE id = ? AND user_id = ?");
    $check->bind_param('ii', $id, $userId);
    $check->execute();
    if ($check->get_result()->num_rows === 0) sendError('Habit not found', 404);

    $stmt = $conn->prepare("DELETE FROM habits WHERE id = ? AND user_id = ?");
    $stmt->bind_param('ii', $id, $userId);
    $stmt->execute();
    echo json_encode(['success' => true]);
    exit;
}

sendError('Method not allowed', 405);