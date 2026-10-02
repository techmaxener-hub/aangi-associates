<?php
declare(strict_types=1);

// Used only by bulk_policy_import.php to SUGGEST which existing client a
// given file in a bulk ZIP upload probably belongs to — always a
// suggestion an admin/staff reviews and can override before anything is
// saved, never an auto-assignment. Real-world filenames from a WhatsApp/
// scanner export are very often the client's own name (e.g. "Chauhan
// Mohammed Owais Abdulamin_P21E6ADNT.pdf"), so the filename is as useful a
// signal here as text pulled from inside the PDF — often more useful,
// since most real insurer PDFs can't be text-extracted at all (see
// pdf_text.php's low_confidence path) but every file still has a name.

/** Lowercases, strips anything that isn't a letter/space, collapses whitespace. */
function normalize_name_for_match(string $name): string
{
    $name = preg_replace('/[^a-zA-Z ]+/', ' ', $name) ?? $name;
    $name = preg_replace('/\s+/', ' ', $name) ?? $name;
    return trim(strtolower($name));
}

/**
 * Strips an uploaded file's extension and the common non-name junk a
 * phone/scanner app appends to a filename (ID-like trailing codes, dates,
 * "(1)" duplicate-download suffixes, "DOC-"/"IMG-"/"Scan" prefixes) down to
 * whatever's left, on the theory that whatever remains is most likely the
 * client's name. Best-effort only — see the caller's confidence score.
 */
function name_candidate_from_filename(string $filename): string
{
    $base = pathinfo($filename, PATHINFO_FILENAME);
    $base = preg_replace('/^(DOC|IMG|SCAN|WA)[-_ ]?/i', '', $base) ?? $base;
    $base = preg_replace('/\(\d+\)$/', '', $base) ?? $base; // "(1)" duplicate suffix
    $base = preg_replace('/[_-]?\d{6,}.*$/', '', $base) ?? $base; // trailing date/id runs of 6+ digits
    $base = preg_replace('/[_-]?P[A-Z0-9]{6,}$/', '', $base) ?? $base; // trailing policy-like code e.g. "_P21E6ADNT"
    $base = str_replace(['_', '-', '.'], ' ', $base);
    return trim($base);
}

/**
 * Token-overlap similarity, 0.0-1.0: the fraction of the shorter name's
 * words that appear (by exact or near-exact token match) in the longer
 * one. Deliberately simple and order-independent — "Abdulamin Chauhan" vs
 * "Chauhan Abdulamin Adam" should match well, and real client/insured
 * names are inconsistently ordered (surname-first vs given-name-first)
 * often enough that an order-sensitive algorithm (plain levenshtein on the
 * whole string) would under-match real, correct pairs.
 */
function name_similarity(string $a, string $b): float
{
    $a = normalize_name_for_match($a);
    $b = normalize_name_for_match($b);
    if ($a === '' || $b === '') return 0.0;
    if ($a === $b) return 1.0;
    $tokensA = array_filter(explode(' ', $a), fn ($t) => strlen($t) >= 2);
    $tokensB = array_filter(explode(' ', $b), fn ($t) => strlen($t) >= 2);
    if (!$tokensA || !$tokensB) return 0.0;
    $shorter = count($tokensA) <= count($tokensB) ? array_values($tokensA) : array_values($tokensB);
    $longer = count($tokensA) <= count($tokensB) ? array_values($tokensB) : array_values($tokensA);
    $matched = 0;
    foreach ($shorter as $tok) {
        foreach ($longer as $other) {
            if ($tok === $other) { $matched++; continue 2; }
            // A short common-prefix match covers initials and minor
            // transliteration spelling differences (e.g. "Mohammed" vs
            // "Mohmmed") without a full edit-distance pass per pair.
            $prefixLen = min(4, strlen($tok), strlen($other));
            if ($prefixLen >= 3 && substr($tok, 0, $prefixLen) === substr($other, 0, $prefixLen)) { $matched++; continue 2; }
        }
    }
    return $matched / count($shorter);
}

/**
 * @param list<array{id:string,full_name:string}> $clients
 * @return array{client_id:string,full_name:string,score:float}|null best match, or null if nothing scored above the threshold
 */
function match_client_by_name(string $candidateName, array $clients, float $threshold = 0.5): ?array
{
    $best = null;
    foreach ($clients as $client) {
        $score = name_similarity($candidateName, $client['full_name']);
        if ($score >= $threshold && ($best === null || $score > $best['score'])) {
            $best = ['client_id' => $client['id'], 'full_name' => $client['full_name'], 'score' => $score];
        }
    }
    return $best;
}
