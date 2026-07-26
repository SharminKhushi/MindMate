<?php
require 'config.php';
require 'helpers.php';

$userId = requireAuth($conn);

$id = $_GET['id'] ?? null;
if (!$id) sendError('Missing habit id');

// Verify this habit belongs to the logged-in user
$check = $conn->prepare("SELECT id FROM habits WHERE id = ? AND user_id = ?");
$check->bind_param('ii', $id, $userId);
$check->execute();
if ($check->get_result()->num_rows === 0) sendError('Habit not found', 404);

$today = todayDate();

$existing = $conn->prepare("SELECT id FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
$existing->bind_param('is', $id, $today);
$existing->execute();
$result = $existing->get_result();

if ($result->num_rows > 0) {
    // Already done today -> undo
    $del = $conn->prepare("DELETE FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
    $del->bind_param('is', $id, $today);
    $del->execute();
    echo json_encode(['success' => true, 'completed' => false]);
} else {
    // Mark done today
    $ins = $conn->prepare("INSERT INTO habit_logs (habit_id, completed_date) VALUES (?, ?)");
    $ins->bind_param('is', $id, $today);
    $ins->execute();
    echo json_encode(['success' => true, 'completed' => true]);
}