<?php
require 'config.php';
require 'helpers.php';

$userId = requireAuth($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT id, title, target_date, progress, created_at FROM goals WHERE user_id = ? ORDER BY created_at DESC");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $goals = [];
    while ($row = $result->fetch_assoc()) {
        $goals[] = [
            'id' => (string)$row['id'],
            'title' => $row['title'],
            'targetDate' => $row['target_date'],
            'progress' => (int)$row['progress'],
            'createdAt' => str_replace(' ', 'T', $row['created_at']) . 'Z'
        ];
    }
    echo json_encode($goals);
    exit;
}

if ($method === 'POST') {
    $input = jsonBody();
    $title = trim($input['title'] ?? '');
    $targetDate = $input['targetDate'] ?: null;

    if ($title === '') sendError('Goal title is required.');

    $stmt = $conn->prepare("INSERT INTO goals (user_id, title, target_date, progress) VALUES (?, ?, ?, 0)");
    $stmt->bind_param('iss', $userId, $title, $targetDate);
    $stmt->execute();

    echo json_encode(['id' => (string)$conn->insert_id, 'success' => true]);
    exit;
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) sendError('Missing goal id');
    $input = jsonBody();

    // Two use cases: full edit (title/date) OR progress adjust (+10/-10)
    if (isset($input['progressDelta'])) {
        $delta = (int)$input['progressDelta'];
        $stmt = $conn->prepare("SELECT progress FROM goals WHERE id = ? AND user_id = ?");
        $stmt->bind_param('ii', $id, $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) sendError('Goal not found', 404);

        $newProgress = max(0, min(100, $row['progress'] + $delta));
        $update = $conn->prepare("UPDATE goals SET progress = ? WHERE id = ? AND user_id = ?");
        $update->bind_param('iii', $newProgress, $id, $userId);
        $update->execute();
        echo json_encode(['success' => true, 'progress' => $newProgress]);
        exit;
    }

    $title = trim($input['title'] ?? '');
    $targetDate = $input['targetDate'] ?: null;
    if ($title === '') sendError('Goal title is required.');

    $stmt = $conn->prepare("UPDATE goals SET title = ?, target_date = ? WHERE id = ? AND user_id = ?");
    $stmt->bind_param('ssii', $title, $targetDate, $id, $userId);
    $stmt->execute();

    if ($stmt->affected_rows === 0) sendError('Goal not found', 404);
    echo json_encode(['success' => true]);
    exit;
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) sendError('Missing goal id');

    $stmt = $conn->prepare("DELETE FROM goals WHERE id = ? AND user_id = ?");
    $stmt->bind_param('ii', $id, $userId);
    $stmt->execute();
    echo json_encode(['success' => true]);
    exit;
}

sendError('Method not allowed', 405);