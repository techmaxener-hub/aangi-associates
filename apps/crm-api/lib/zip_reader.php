<?php
declare(strict_types=1);

// A minimal, pure-PHP ZIP reader — same rationale as lib/pdf_text.php: no
// Imagick, no exec, no Composer package, and (unlike pdf_text.php's zlib
// dependency) not even a guaranteed-enabled PHP extension — ext-zip is
// common but NOT confirmed enabled on this project's actual Hostinger
// account, so this reads the ZIP format directly instead of depending on
// ZipArchive. It only needs zlib's raw-deflate inflate (gzinflate), already
// relied on elsewhere in this codebase.
//
// Supports: the "End of Central Directory" + "Central Directory" records
// (so it works even when a local file header lies about sizes, which some
// zip writers do), and compression methods 0 (stored) and 8 (deflate) —
// together these cover essentially every zip a phone, Windows "Send to
// compressed folder", 7-Zip, or WinRAR produces. Does NOT support: ZIP64
// (needed only for a single entry or archive over ~4GB — never the case
// for a folder of policy PDFs), encrypted entries, or any other
// compression method (PKWARE deflate64, bzip2, LZMA) — those are rare
// enough in practice that refusing with a clear error is the right call
// rather than adding more decoders no one asked for.

/**
 * @return array{ok:true, entries:list<array{name:string,size:int,method:int,cd_offset:int}>}|array{ok:false,error:string}
 */
function zip_list_entries(string $bytes): array
{
    $len = strlen($bytes);
    // The End Of Central Directory record is a fixed 22-byte struct ending
    // the file, optionally followed by a comment — search backwards for its
    // signature rather than assuming it's the very last 22 bytes.
    $eocdSig = "\x50\x4b\x05\x06";
    $searchFrom = max(0, $len - 66000); // EOCD comment is at most 65535 bytes
    $eocdPos = strrpos(substr($bytes, $searchFrom), $eocdSig);
    if ($eocdPos === false) return ['ok' => false, 'error' => 'Not a valid ZIP file (no end-of-central-directory record found)'];
    $eocdPos += $searchFrom;

    $eocd = substr($bytes, $eocdPos, 22);
    $entryCount = unpack('v', substr($eocd, 10, 2))[1];
    $cdSize = unpack('V', substr($eocd, 12, 4))[1];
    $cdOffset = unpack('V', substr($eocd, 16, 4))[1];

    if ($cdOffset + $cdSize > $len) return ['ok' => false, 'error' => 'ZIP central directory is truncated or this archive uses ZIP64, which is not supported'];

    $entries = [];
    $pos = $cdOffset;
    $cdSig = "\x50\x4b\x01\x02";
    for ($i = 0; $i < $entryCount; $i++) {
        if (substr($bytes, $pos, 4) !== $cdSig) break; // corrupt/truncated — return whatever was found
        $hdr = substr($bytes, $pos, 46);
        $method = unpack('v', substr($hdr, 10, 2))[1];
        $compSize = unpack('V', substr($hdr, 20, 4))[1];
        $uncompSize = unpack('V', substr($hdr, 24, 4))[1];
        $nameLen = unpack('v', substr($hdr, 28, 2))[1];
        $extraLen = unpack('v', substr($hdr, 30, 2))[1];
        $commentLen = unpack('v', substr($hdr, 32, 2))[1];
        $localHeaderOffset = unpack('V', substr($hdr, 42, 4))[1];
        $name = substr($bytes, $pos + 46, $nameLen);
        // A trailing "/" with zero size is a directory entry, not a file.
        if (substr($name, -1) !== '/') {
            $entries[] = [
                'name' => $name,
                'size' => $uncompSize,
                'comp_size' => $compSize,
                'method' => $method,
                'local_offset' => $localHeaderOffset,
            ];
        }
        $pos += 46 + $nameLen + $extraLen + $commentLen;
    }
    return ['ok' => true, 'entries' => $entries];
}

/** @param array{name:string,size:int,comp_size:int,method:int,local_offset:int} $entry */
function zip_read_entry(string $bytes, array $entry): ?string
{
    $pos = $entry['local_offset'];
    if (substr($bytes, $pos, 4) !== "\x50\x4b\x03\x04") return null; // not a valid local file header
    $nameLen = unpack('v', substr($bytes, $pos + 26, 2))[1];
    $extraLen = unpack('v', substr($bytes, $pos + 28, 2))[1];
    $dataStart = $pos + 30 + $nameLen + $extraLen;
    $compressed = substr($bytes, $dataStart, $entry['comp_size']);

    if ($entry['method'] === 0) return $compressed; // stored, no compression
    if ($entry['method'] === 8) {
        // Entries are plain "raw deflate" (no zlib header) per the ZIP spec —
        // gzinflate, not gzuncompress. Cap output at the entry's own
        // declared uncompressed size (plus slack) so a corrupt/hostile
        // size field can't be used to inflate something huge.
        $decoded = @gzinflate($compressed, max($entry['size'], 1024) + 1024);
        return $decoded !== false ? $decoded : null;
    }
    return null; // unsupported compression method (see file header comment)
}
