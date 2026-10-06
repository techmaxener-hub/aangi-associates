<?php
declare(strict_types=1);

// A minimal, pure-PHP QR code matrix generator — same zero-dependency
// rationale as the rest of this app's PDF code: no Imagick, no exec, no
// Composer package (a QR barcode is just a grid of black/white squares,
// which this hand-rolled PDF writer can paint directly as vector
// rectangles — no image library needed at all).
//
// Deliberately scoped down from the full ISO/IEC 18004 spec to exactly
// what this app needs: short ASCII URLs (wa.me / the website), byte mode
// only, error-correction level L only, versions 1-5 only (up to 108 data
// bytes — comfortably covers every URL this app actually embeds), and a
// FIXED mask pattern (0) rather than evaluating all 8 and scoring
// penalties. Mask choice only affects scan robustness in adversarial
// conditions, never correctness — any spec-compliant reader decodes any
// of the 8 valid masks identically, since the mask number is itself
// encoded in the format info bits the reader reads first. Limiting scope
// this way keeps the implementation auditable instead of attempting a
// general-purpose encoder with no way to test-scan the output.
//
// If the input is too long for version 5 at level L, qr_generate_matrix()
// returns null — callers must treat a QR code as a nice-to-have visual
// and skip it gracefully, never crash the PDF over it.

// ---- GF(256) arithmetic (QR's field, primitive polynomial 0x11D) ----------

/** @return array{0:list<int>,1:list<int>} [exp table (size 512, doubled to avoid modulo in multiply), log table (size 256)] */
function qr_gf256_tables(): array
{
    static $tables = null;
    if ($tables !== null) return $tables;
    $exp = array_fill(0, 512, 0);
    $log = array_fill(0, 256, 0);
    $x = 1;
    for ($i = 0; $i < 255; $i++) {
        $exp[$i] = $x;
        $log[$x] = $i;
        $x <<= 1;
        if ($x & 0x100) $x ^= 0x11D;
    }
    for ($i = 255; $i < 512; $i++) $exp[$i] = $exp[$i - 255];
    return $tables = [$exp, $log];
}

function qr_gf_mul(int $a, int $b): int
{
    if ($a === 0 || $b === 0) return 0;
    [$exp, $log] = qr_gf256_tables();
    return $exp[$log[$a] + $log[$b]];
}

/** Reed-Solomon generator polynomial of degree $ecLen, as a list of GF(256) coefficients (highest degree first, leading term implicit 1 not included at index 0 the way this builds it — standard iterative construction). */
function qr_rs_generator_poly(int $ecLen): array
{
    [$exp, ] = qr_gf256_tables();
    $poly = [1];
    for ($i = 0; $i < $ecLen; $i++) {
        $next = array_fill(0, count($poly) + 1, 0);
        for ($j = 0; $j < count($poly); $j++) {
            $next[$j] ^= qr_gf_mul($poly[$j], $exp[$i]);
            $next[$j + 1] ^= $poly[$j];
        }
        $poly = $next;
    }
    return $poly;
}

/** @param list<int> $data @return list<int> the $ecLen Reed-Solomon error-correction codewords for $data. */
function qr_rs_encode(array $data, int $ecLen): array
{
    $gen = qr_rs_generator_poly($ecLen);
    $remainder = array_merge($data, array_fill(0, $ecLen, 0));
    for ($i = 0; $i < count($data); $i++) {
        $coef = $remainder[$i];
        if ($coef === 0) continue;
        for ($j = 0; $j < count($gen); $j++) {
            $remainder[$i + $j] ^= qr_gf_mul($gen[$j], $coef);
        }
    }
    return array_slice($remainder, count($data));
}

// ---- Capacity table, error-correction level L, versions 1-5, single RS block --
// [version => [total_codewords, ec_codewords, data_codewords, module_size]]
const QR_L_CAPACITY = [
    1 => [26, 7, 19, 21],
    2 => [44, 10, 34, 25],
    3 => [70, 15, 55, 29],
    4 => [100, 20, 80, 33],
    5 => [134, 26, 108, 37],
];
// Single alignment-pattern center (row=col) for versions 2-5 — see this
// file's header comment for why there's exactly one for these versions
// (the other 3 combinations of the spec's coordinate list always overlap
// one of the 3 finder patterns and are skipped). Version 1 has none.
const QR_ALIGNMENT_CENTER = [2 => 18, 3 => 22, 4 => 26, 5 => 30];

/**
 * Builds the bit stream for byte-mode data: mode indicator (0100),
 * 8-bit character count indicator (versions 1-9), the data bytes
 * themselves, a terminator, then pads to the data codeword capacity with
 * the standard alternating 0xEC/0x11 pad bytes.
 * @return list<int>|null null if $data doesn't fit any supported version.
 */
function qr_build_data_codewords(string $data, int $version): ?array
{
    if (!isset(QR_L_CAPACITY[$version])) return null;
    [, , $dataCw] = QR_L_CAPACITY[$version];
    $len = strlen($data);
    $bits = '0100' . str_pad(decbin($len), 8, '0', STR_PAD_LEFT);
    for ($i = 0; $i < $len; $i++) $bits .= str_pad(decbin(ord($data[$i])), 8, '0', STR_PAD_LEFT);
    $capacityBits = $dataCw * 8;
    if (strlen($bits) > $capacityBits) return null; // doesn't fit this version
    $bits .= str_repeat('0', min(4, $capacityBits - strlen($bits))); // terminator (up to 4 zero bits)
    while (strlen($bits) % 8 !== 0) $bits .= '0'; // pad to a byte boundary
    $codewords = [];
    for ($i = 0; $i < strlen($bits); $i += 8) $codewords[] = bindec(substr($bits, $i, 8));
    $pad = [0xEC, 0x11];
    $p = 0;
    while (count($codewords) < $dataCw) { $codewords[] = $pad[$p % 2]; $p++; }
    return $codewords;
}

/** Picks the smallest version (1-5, level L) whose byte-mode capacity fits $data, or null if even version 5 doesn't. */
function qr_pick_version(string $data): ?int
{
    foreach (QR_L_CAPACITY as $version => [, , $dataCw]) {
        // 4-bit mode + 8-bit count + data bits must fit in dataCw*8 bits.
        if (4 + 8 + strlen($data) * 8 <= $dataCw * 8) return $version;
    }
    return null;
}

/** BCH(15,5) format info for level L (bits '01') + the given 3-bit mask pattern, XORed with the spec's fixed mask 0x5412. Returns a 15-char '0'/'1' string. */
function qr_format_info_bits(int $maskPattern): string
{
    $ecBits = 0b01; // level L
    $data = ($ecBits << 3) | $maskPattern; // 5 bits
    $value = $data << 10;
    $gen = 0b10100110111; // g(x) = x^10+x^8+x^5+x^4+x^2+x+1
    for ($i = 14; $i >= 10; $i--) {
        if ($value & (1 << $i)) $value ^= $gen << ($i - 10);
    }
    $format = (($data << 10) | $value) ^ 0b101010000010010;
    return str_pad(decbin($format), 15, '0', STR_PAD_LEFT);
}

/**
 * Builds the full module matrix for $data (an ASCII string — this app
 * only ever feeds it a plain https:// URL). Returns a square array of
 * bool (true = dark module) sized to the chosen version's module count,
 * or null if the data is too long for any supported version.
 *
 * @return list<list<bool>>|null
 */
function qr_generate_matrix(string $data): ?array
{
    $version = qr_pick_version($data);
    if ($version === null) return null;
    [$totalCw, $ecCw, $dataCw, $size] = QR_L_CAPACITY[$version];
    $dataWords = qr_build_data_codewords($data, $version);
    if ($dataWords === null) return null;
    $ecWords = qr_rs_encode($dataWords, $ecCw);
    $allWords = array_merge($dataWords, $ecWords);
    if (count($allWords) !== $totalCw) return null; // sanity guard, never expected to trip

    $matrix = array_fill(0, $size, array_fill(0, $size, false));
    $reserved = array_fill(0, $size, array_fill(0, $size, false));

    $setFinder = function (int $row, int $col) use (&$matrix, &$reserved, $size) {
        for ($dr = -1; $dr <= 7; $dr++) {
            for ($dc = -1; $dc <= 7; $dc++) {
                $r = $row + $dr;
                $c = $col + $dc;
                if ($r < 0 || $r >= $size || $c < 0 || $c >= $size) continue;
                $reserved[$r][$c] = true;
                $inRing = ($dr >= 0 && $dr <= 6 && $dc >= 0 && $dc <= 6)
                    && ($dr === 0 || $dr === 6 || $dc === 0 || $dc === 6 || ($dr >= 2 && $dr <= 4 && $dc >= 2 && $dc <= 4));
                $matrix[$r][$c] = $inRing;
            }
        }
    };
    $setFinder(0, 0);
    $setFinder(0, $size - 7);
    $setFinder($size - 7, 0);

    // Timing patterns (row 6 and column 6, alternating starting dark).
    for ($i = 8; $i < $size - 8; $i++) {
        $dark = $i % 2 === 0;
        $matrix[6][$i] = $dark; $reserved[6][$i] = true;
        $matrix[$i][6] = $dark; $reserved[$i][6] = true;
    }

    // Single alignment pattern (versions 2-5 only — see constant above).
    if (isset(QR_ALIGNMENT_CENTER[$version])) {
        $ac = QR_ALIGNMENT_CENTER[$version];
        for ($dr = -2; $dr <= 2; $dr++) {
            for ($dc = -2; $dc <= 2; $dc++) {
                $r = $ac + $dr; $c = $ac + $dc;
                $reserved[$r][$c] = true;
                $matrix[$r][$c] = (max(abs($dr), abs($dc)) !== 1);
            }
        }
    }

    // Dark module (always present, fixed position).
    $matrix[$size - 8][8] = true;
    $reserved[$size - 8][8] = true;

    // Reserve the exact 15+15 format-info module positions (filled in
    // with real bits after data placement, below) — NOT an approximate
    // "whole row 8 / column 8 near each end" sweep. That approximation
    // was tried first and is wrong: it over-reserves 2 real data modules
    // per version (row 8/col 12 and row 12/col 8, one step past the true
    // boundary), which silently truncated the last 1-2 codeword bits off
    // every generated code — caught by an independent decode self-check
    // (qr_verify.php) that found a non-zero Reed-Solomon syndrome before
    // this was ever used in a real PDF. Building the reservation from the
    // *same* $copy1/$copy2 lists used to write the bits later makes the
    // two impossible to drift apart again.
    $copy1 = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    $copy2 = [
        [$size - 1, 8], [$size - 2, 8], [$size - 3, 8], [$size - 4, 8], [$size - 5, 8], [$size - 6, 8], [$size - 7, 8],
        [8, $size - 8], [8, $size - 7], [8, $size - 6], [8, $size - 5], [8, $size - 4], [8, $size - 3], [8, $size - 2], [8, $size - 1],
    ];
    foreach ([$copy1, $copy2] as $copy) foreach ($copy as [$r, $c]) $reserved[$r][$c] = true;

    // Place data bits in the standard zigzag: two columns at a time,
    // starting from the rightmost pair and working left, alternating
    // bottom-to-top / top-to-bottom each pair, skipping any reserved
    // module. The vertical timing column (col 6) is never paired with —
    // when the descending column counter would land on it, it drops one
    // extra column (to 5) first, which is what keeps the pairing exactly
    // covering all `size - 1` non-timing columns with none doubled up
    // (verified by hand for version 1's 21 columns before trusting it
    // for the general case: 20,19 / 18,17 / ... / 8,7 / [skip 6] 5,4 /
    // 3,2 / 1,0 — every column 0-20 except 6 appears exactly once).
    // Mask pattern 0 ((row+col) even => on) is applied as each bit is
    // placed — see this file's header comment for why a fixed mask
    // (rather than evaluating all 8) is an acceptable, spec-compliant
    // simplification here.
    $bits = '';
    foreach ($allWords as $w) $bits .= str_pad(decbin($w), 8, '0', STR_PAD_LEFT);
    $bitIndex = 0;
    $totalBits = strlen($bits);
    $upward = true;
    $col = $size - 1;
    while ($col > 0) {
        $rows = $upward ? range($size - 1, 0, -1) : range(0, $size - 1, 1);
        foreach ($rows as $row) {
            foreach ([$col, $col - 1] as $c) {
                if ($reserved[$row][$c]) continue;
                $bit = $bitIndex < $totalBits && $bits[$bitIndex] === '1';
                $bitIndex++;
                $mask = (($row + $c) % 2) === 0;
                $matrix[$row][$c] = $bit !== $mask; // boolean XOR
            }
        }
        $upward = !$upward;
        $col -= 2;
        if ($col === 6) $col = 5; // skip the entire timing column, not just skip-and-continue
    }

    // Format info (mask pattern 0, level L), placed at its two standard
    // locations — using the exact same $copy1/$copy2 position lists the
    // reservation step above built (see that comment for why these were
    // hand cross-checked against the ISO 18004 placement diagram rather
    // than generated from a loop: a transposed row/col here would
    // silently make every generated code unreadable).
    $fmt = qr_format_info_bits(0);
    foreach ($copy1 as $i => [$r, $c]) $matrix[$r][$c] = $fmt[$i] === '1';
    foreach ($copy2 as $i => [$r, $c]) $matrix[$r][$c] = $fmt[$i] === '1';

    return $matrix;
}
