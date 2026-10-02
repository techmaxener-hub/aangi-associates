<?php
declare(strict_types=1);
require __DIR__ . '/config.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/intimation.php';
require __DIR__ . '/lib/pdf_write.php';

// Admin/Staff-only. Mirrors the new "Intimations" CRM page: GET returns
// today's (or ?date=YYYY-MM-DD's) due birthday/renewal items so the page
// can show a "Send via WhatsApp" button per row (the browser-side
// equivalent of the PDF/email's button — both ultimately point at the
// same dispatch_token redirect, so a click from either place marks the
// same intimation_items row). GET ?pdf=1 streams the same day's items as
// a downloadable PDF instead, built by lib/pdf_write.php.

require_role('admin', 'staff');

$date = $_GET['date'] ?? gmdate('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) json_error('date must be YYYY-MM-DD', 422);

$items = intimation_due_items($date);

if (!empty($_GET['pdf'])) {
    $pdf = pdf_write_intimation_digest($date, $items);
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="intimation-digest-' . $date . '.pdf"');
    header('Content-Length: ' . (string) strlen($pdf));
    echo $pdf;
    exit;
}

json_out($items);
