<?php
function getBearerToken() {
    $headers = getallheaders();
    foreach ($headers as $key => $value) {
        if (strtolower($key) === 'authorization' && stripos($value, 'Bearer ') === 0) {
            return substr($value, 7);
        }
    }
    return null;
}

function requireAuth($conn) {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        die(json_encode(['error' => 'No token provided']));
    }
    $stmt = $conn->prepare("SELECT user_id FROM sessions WHERE token = ?");
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        http_response_code(401);
        die(json_encode(['error' => 'Invalid or expired session']));
    }
    return $result->fetch_assoc()['user_id'];
}

/* ---------- Shared helpers used across multiple API files ---------- */

function jsonBody() {
    return json_decode(file_get_contents('php://input'), true) ?: [];
}

function todayDate() {
    return date('Y-m-d');
}

/* Monday of the current week — used for grace-day tracking */
function weekStartDate($dateStr = null) {
    $d = $dateStr ? new DateTime($dateStr) : new DateTime();
    $dayOfWeek = (int)$d->format('N'); // 1 (Mon) - 7 (Sun)
    $d->modify('-' . ($dayOfWeek - 1) . ' days');
    return $d->format('Y-m-d');
}

/* Standard error response */
function sendError($message, $code = 400) {
    http_response_code($code);
    die(json_encode(['error' => $message]));
}