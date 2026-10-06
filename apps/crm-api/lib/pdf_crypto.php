<?php
declare(strict_types=1);

// Pure-PHP implementation of the PDF "Standard Security Handler", V2/R3
// (RC4, 128-bit key) — the classic "Acrobat 5"-compatible encryption
// level, chosen because it's the most broadly supported by PDF readers
// of any age (AES would be stronger but V2/R3 RC4 is adequate for this
// app's actual threat model: keeping a policy summary from being read by
// whoever it wasn't addressed to if an email/WhatsApp message is
// intercepted or forwarded by mistake, not defending against a
// determined attacker with the file in hand).
//
// Used by policy_summary.php's `action=email` path only (never for
// admin/staff downloads, which are already behind an authenticated
// session) — see that file for how the "user password" (the one needed
// to OPEN the PDF) is chosen.
//
// Implements exactly ISO 32000-1 Annex 7.6 algorithms 3.1-3.5 for
// Revision 3. No Composer package — MD5 is core PHP (hash('md5', ...,
// true)); RC4 is ~15 lines and not in any PHP extension, so it's
// hand-rolled below.

const PDF_CRYPTO_PAD = "\x28\xBF\x4E\x5E\x4E\x75\x8A\x41\x64\x00\x4E\x56\xFF\xFA\x01\x08"
    . "\x2E\x2E\x00\xB6\xD0\x68\x3E\x80\x2F\x0C\xA9\xFE\x64\x53\x69\x7A";

/** RC4 stream cipher — symmetric (same function encrypts and decrypts). */
function pdf_rc4(string $key, string $data): string
{
    $klen = strlen($key);
    $s = range(0, 255);
    $j = 0;
    for ($i = 0; $i < 256; $i++) {
        $j = ($j + $s[$i] + ord($key[$i % $klen])) & 0xFF;
        [$s[$i], $s[$j]] = [$s[$j], $s[$i]];
    }
    $out = '';
    $i = 0;
    $j = 0;
    $len = strlen($data);
    for ($n = 0; $n < $len; $n++) {
        $i = ($i + 1) & 0xFF;
        $j = ($j + $s[$i]) & 0xFF;
        [$s[$i], $s[$j]] = [$s[$j], $s[$i]];
        $out .= chr(ord($data[$n]) ^ $s[($s[$i] + $s[$j]) & 0xFF]);
    }
    return $out;
}

/** Algorithm 2.B/3.1's padding step: truncate to 32 bytes, or pad with the spec's fixed PDF_CRYPTO_PAD bytes up to 32. */
function pdf_crypto_pad_password(string $password): string
{
    if (strlen($password) >= 32) return substr($password, 0, 32);
    return $password . substr(PDF_CRYPTO_PAD, 0, 32 - strlen($password));
}

/** Algorithm 3.3: computes the /O (owner key) entry, 32 bytes. */
function pdf_crypto_compute_o(string $ownerPassword, string $userPassword, int $keyLen = 16): string
{
    $padded = pdf_crypto_pad_password($ownerPassword !== '' ? $ownerPassword : $userPassword);
    $hash = hash('md5', $padded, true);
    for ($i = 0; $i < 50; $i++) $hash = hash('md5', substr($hash, 0, $keyLen), true);
    $key = substr($hash, 0, $keyLen);
    $result = pdf_rc4($key, pdf_crypto_pad_password($userPassword));
    for ($i = 1; $i <= 19; $i++) {
        $roundKey = '';
        for ($b = 0; $b < $keyLen; $b++) $roundKey .= chr(ord($key[$b]) ^ $i);
        $result = pdf_rc4($roundKey, $result);
    }
    return $result;
}

/** Algorithm 3.2: computes the file encryption key (16 bytes for 128-bit/R3) from the user password, the already-computed /O value, the permissions flags, and the first /ID element. */
function pdf_crypto_compute_file_key(string $userPassword, string $o, int $permissions, string $idFirst, int $keyLen = 16): string
{
    $input = pdf_crypto_pad_password($userPassword)
        . $o
        . pack('V', $permissions & 0xFFFFFFFF)
        . $idFirst;
    $hash = hash('md5', $input, true);
    for ($i = 0; $i < 50; $i++) $hash = hash('md5', substr($hash, 0, $keyLen), true);
    return substr($hash, 0, $keyLen);
}

/** Algorithm 3.5 (Revision 3): computes the /U (user key) entry, 32 bytes (16 real + 16 arbitrary padding — zero bytes here, which the spec explicitly allows). */
function pdf_crypto_compute_u(string $fileKey, string $idFirst, int $keyLen = 16): string
{
    $hash = hash('md5', PDF_CRYPTO_PAD . $idFirst, true);
    $result = pdf_rc4($fileKey, $hash);
    for ($i = 1; $i <= 19; $i++) {
        $roundKey = '';
        for ($b = 0; $b < $keyLen; $b++) $roundKey .= chr(ord($fileKey[$b]) ^ $i);
        $result = pdf_rc4($roundKey, $result);
    }
    return $result . str_repeat("\x00", 16);
}

/** Algorithm 3.1: derives the per-object RC4 key from the file key and that object's number/generation. */
function pdf_crypto_object_key(string $fileKey, int $objNum, int $genNum): string
{
    $keyLen = strlen($fileKey);
    $input = $fileKey
        . chr($objNum & 0xFF) . chr(($objNum >> 8) & 0xFF) . chr(($objNum >> 16) & 0xFF)
        . chr($genNum & 0xFF) . chr(($genNum >> 8) & 0xFF);
    $hash = hash('md5', $input, true);
    return substr($hash, 0, min($keyLen + 5, 16));
}

/**
 * Bundles everything pdf_assemble_document() needs to encrypt a document:
 * the /ID, /O, /U, /P values and a closure that derives any given
 * object's RC4 key. Call once per document.
 *
 * @return array{id:string,o:string,u:string,p:int,object_key:callable(int,int):string}
 */
function pdf_crypto_prepare(string $userPassword, ?string $ownerPassword = null): array
{
    $id = random_bytes(16);
    // -4 as a 32-bit value (0xFFFFFFFC) grants every permission bit the
    // spec defines (printing, copying, annotating, etc.) — this feature
    // exists to require a password to OPEN the file at all, not to
    // restrict what someone who knows that password can then do with it.
    $permissions = -4;
    $owner = $ownerPassword ?? bin2hex(random_bytes(8)); // never shared with anyone; only needed so /O is well-defined
    $o = pdf_crypto_compute_o($owner, $userPassword);
    $fileKey = pdf_crypto_compute_file_key($userPassword, $o, $permissions, $id);
    $u = pdf_crypto_compute_u($fileKey, $id);
    return [
        'id' => $id,
        'o' => $o,
        'u' => $u,
        'p' => $permissions,
        'object_key' => fn (int $objNum, int $genNum) => pdf_crypto_object_key($fileKey, $objNum, $genNum),
    ];
}

/** PDF literal-string escaping for raw (possibly binary) bytes — used for encrypted string values where a hex string isn't already in use. */
function pdf_crypto_escape_literal(string $bytes): string
{
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $bytes);
}

/** Encodes raw bytes as a PDF hex string literal `<48656c6c6f>` — used for encrypted URIs, since the ciphertext is arbitrary binary and a hex string needs no escaping at all. */
function pdf_crypto_hex_string(string $bytes): string
{
    return '<' . strtoupper(bin2hex($bytes)) . '>';
}
