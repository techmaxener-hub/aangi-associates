<?php
declare(strict_types=1);

// Template-rendering helpers shared by the Admin/Staff intimation digest
// (lib/intimation.php). The direct-send WhatsApp Cloud API functions that
// used to live here were removed — per the explicit pivot away from any
// automatic client-facing send ("No need to share whatsapp or Email to
// client now. Only construct robust Admin/Staff intimation automation"),
// this file's only job now is filling in an admin-edited message template
// with real values; cron/renewal_reminders.php's own (separate, untouched,
// currently-inert) direct-send logic keeps its own private copy of the
// Cloud API call it still makes when credentials are configured.

/** Fills {{placeholders}} in an admin-edited template; an unknown placeholder is left as-is rather than silently dropped. */
function render_template(string $template, array $vars): string
{
    return preg_replace_callback('/\{\{(\w+)\}\}/', function ($m) use ($vars) {
        return array_key_exists($m[1], $vars) ? (string) $vars[$m[1]] : $m[0];
    }, $template);
}

/** message_templates is a singleton seeded by seed.sql; this fallback only matters if that row is ever missing. */
function message_template(string $column, string $fallback): string
{
    $stmt = db()->prepare("SELECT $column FROM message_templates WHERE id = 1");
    $stmt->execute();
    $val = $stmt->fetchColumn();
    return $val !== false && trim((string) $val) !== '' ? $val : $fallback;
}
