<?php
require 'config.php';
require 'helpers.php';

$action = $_GET['action'] ?? '';
$input = jsonBody();

/* ---------- REGISTER ---------- */
if ($action === 'register') {
    $name = trim($input['name'] ?? '');
    $age = intval($input['age'] ?? 0);
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    if (strlen($name) < 2 || $age < 13 || $age > 19 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
        sendError('Please check your name, age, email, and password.');
    }

    $check = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $check->bind_param('s', $email);
    $check->execute();
    if ($check->get_result()->num_rows > 0) {
        sendError('An account with this email already exists.', 409);
    }

    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO users (name, email, password, age, avatar) VALUES (?, ?, ?, ?, '🙂')");
    $stmt->bind_param('sssi', $name, $email, $hashed, $age);
    $stmt->execute();
    $userId = $conn->insert_id;

    $token = bin2hex(random_bytes(32));
    $sessionStmt = $conn->prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)");
    $sessionStmt->bind_param('si', $token, $userId);
    $sessionStmt->execute();

    echo json_encode([
        'token' => $token,
        'user' => ['id' => $userId, 'name' => $name, 'email' => $email, 'age' => $age, 'avatar' => '🙂']
    ]);
    exit;
}

/* ---------- LOGIN ---------- */
if ($action === 'login') {
    $email = strtolower(trim($input['email'] ?? ''));
    $password = $input['password'] ?? '';

    $stmt = $conn->prepare("SELECT id, name, email, password, age, avatar FROM users WHERE email = ?");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        sendError("We couldn't find an account with that email and password.", 401);
    }

    $user = $result->fetch_assoc();
    if (!password_verify($password, $user['password'])) {
        sendError("We couldn't find an account with that email and password.", 401);
    }

    $token = bin2hex(random_bytes(32));
    $sessionStmt = $conn->prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)");
    $sessionStmt->bind_param('si', $token, $user['id']);
    $sessionStmt->execute();

    unset($user['password']);
    echo json_encode(['token' => $token, 'user' => $user]);
    exit;
}

/* ---------- LOGOUT ---------- */
if ($action === 'logout') {
    requireAuth($conn);
    $token = getBearerToken();
    $stmt = $conn->prepare("DELETE FROM sessions WHERE token = ?");
    $stmt->bind_param('s', $token);
    $stmt->execute();
    echo json_encode(['success' => true]);
    exit;
}

/* ---------- ME (session check) ---------- */
if ($action === 'me') {
    $userId = requireAuth($conn);
    $stmt = $conn->prepare("SELECT id, name, email, age, avatar FROM users WHERE id = ?");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    echo json_encode(['user' => $stmt->get_result()->fetch_assoc()]);
    exit;
}

/* ---------- CHANGE PASSWORD ---------- */
if ($action === 'change-password') {
    $userId = requireAuth($conn);
    $currentPassword = $input['currentPassword'] ?? '';
    $newPassword = $input['newPassword'] ?? '';

    if (strlen($newPassword) < 6) sendError('New password must be at least 6 characters.');

    $stmt = $conn->prepare("SELECT password FROM users WHERE id = ?");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

   if (!password_verify($currentPassword, $user['password'])) {
    sendError('Current password is incorrect.', 400);
}

    $hashed = password_hash($newPassword, PASSWORD_DEFAULT);
    $update = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
    $update->bind_param('si', $hashed, $userId);
    $update->execute();

    echo json_encode(['success' => true]);
    exit;
}
/* ---------- DELETE ACCOUNT ---------- */
if ($action === 'delete-account') {
    $userId = requireAuth($conn);
    $stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    // ON DELETE CASCADE removes journal/goals/habits/checkins/contacts/challenges/achievements automatically
    echo json_encode(['success' => true]);
    exit;
}

sendError('Unknown action', 400);