<?php
require 'config.php';
require 'helpers.php';

$userId = requireAuth($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT id, name, relation FROM contacts WHERE user_id = ? ORDER BY id ASC");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    $contacts = [];
    while ($row = $result->fetch_assoc()) {
        $contacts[] = ['id' => (string)$row['id'], 'name' => $row['name'], 'relation' => $row['relation']];
    }
    echo json_encode($contacts);
    exit;
}

if ($method === 'POST') {
    $input = jsonBody();
    $name = trim($input['name'] ?? '');
    $relation = trim($input['relation'] ?? '');
    if ($name === '' || $relation === '') sendError('Name and relation are required.');

    $stmt = $conn->prepare("INSERT INTO contacts (user_id, name, relation) VALUES (?, ?, ?)");
    $stmt->bind_param('iss', $userId, $name, $relation);
    $stmt->execute();

    echo json_encode(['id' => (string)$conn->insert_id, 'success' => true]);
    exit;
}

if ($method === 'PUT') {
    $id = $_GET['id'] ?? null;
    if (!$id) sendError('Missing contact id');
    $input = jsonBody();
    $name = trim($input['name'] ?? '');
    $relation = trim($input['relation'] ?? '');
    if ($name === '' || $relation === '') sendError('Name and relation are required.');

    $stmt = $conn->prepare("UPDATE contacts SET name = ?, relation = ? WHERE id = ? AND user_id = ?");
    $stmt->bind_param('ssii', $name, $relation, $id, $userId);
    $stmt->execute();

    if ($stmt->affected_rows === 0) sendError('Contact not found', 404);
    echo json_encode(['success' => true]);
    exit;
}

if ($method === 'DELETE') {
    $id = $_GET['id'] ?? null;
    if (!$id) sendError('Missing contact id');

    $stmt = $conn->prepare("DELETE FROM contacts WHERE id = ? AND user_id = ?");
    $stmt->bind_param('ii', $id, $userId);
    $stmt->execute();
    echo json_encode(['success' => true]);
    exit;
}

sendError('Method not allowed', 405);