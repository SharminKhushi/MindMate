<?php
require 'config.php';
require 'helpers.php';

$userId = requireAuth($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT id, title, text, tags, entry_date, created_at FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $entries = [];
    while ($row = $result->fetch_assoc()) {
        $entries[] = [
            'id' => (string)$row['id'],
            'title' => $row['title'],
            'text' => $row['text'],
            'tags' => json_decode($row['tags'] ?? '[]', true) ?: [],
            'date' => $row['entry_date'],
            'timestamp' => str_replace(' ', 'T', $row['created_at']) . 'Z'
        ];
    }
    echo json_encode($entries);
    exit;
}

if ($method === 'POST') {
    $input = jsonBody();
    $title = trim($input['title'] ?? '') ?: 'My Journal Entry';
    $text = $input['text'] ?? '';
    $tags = json_encode($input['tags'] ?? []);
    $date = $input['date'] ?? todayDate();

    if (trim($text) === '') sendError('Entry text cannot be empty.');

    $stmt = $conn->prepare("INSERT INTO journal_entries (user_id, title, text, tags, entry_date) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param('issss', $userId, $title, $text, $tags, $date);
    $stmt->execute();

    echo json_encode(['id' => (string)$conn->insert_id, 'success' => true]);
    exit;
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) sendError('Missing entry id');

    $input = jsonBody();
    $title = trim($input['title'] ?? '') ?: 'My Journal Entry';
    $text = $input['text'] ?? '';
    $tags = json_encode($input['tags'] ?? []);

    $stmt = $conn->prepare("UPDATE journal_entries SET title = ?, text = ?, tags = ? WHERE id = ? AND user_id = ?");
    $stmt->bind_param('sssii', $title, $text, $tags, $id, $userId);
    $stmt->execute();

    if ($stmt->affected_rows === 0) sendError('Entry not found', 404);
    echo json_encode(['success' => true]);
    exit;
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) sendError('Missing entry id');

    $stmt = $conn->prepare("DELETE FROM journal_entries WHERE id = ? AND user_id = ?");
    $stmt->bind_param('ii', $id, $userId);
    $stmt->execute();
    echo json_encode(['success' => true]);
    exit;
}

sendError('Method not allowed', 405);