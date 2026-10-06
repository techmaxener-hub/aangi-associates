<?php
declare(strict_types=1);

// A minimal, pure-PHP ZIP *writer* — the counterpart to lib/zip_reader.php
// (which explicitly avoids the ZipArchive class/ext-zip since it isn't
// confirmed enabled on this project's real Hostinger account; see that
// file's header). No writer existed before this, needed for bulk PDF
// export (one ZIP of several policy-summary PDFs for a household).
//
// Deliberately STORE-only (no deflate compression) — every entry is
// written uncompressed. This is a fully valid ZIP (method 0 is part of
// the base spec every unzip tool supports) and sidesteps re-implementing
// DEFLATE's LZ77+Huffman coding, which this app has no use for anyway:
// the entries are PDFs, which are already internally compressed-ish
// (JPEG image streams, etc.), so deflating them again would barely
// shrink the archive.

/**
 * @param array<string, string> $files Map of archive entry name => raw file bytes.
 * @return string The complete .zip file bytes.
 */
function zip_build(array $files): string
{
    $out = '';
    $centralDir = '';
    $offset = 0;
    $count = 0;

    foreach ($files as $name => $bytes) {
        $name = str_replace('\\', '/', $name); // zip entries always use forward slashes
        $crc = crc32($bytes);
        $size = strlen($bytes);
        [$dosTime, $dosDate] = zip_dos_datetime();

        $nameLen = strlen($name);
        $localHeader = "PK\x03\x04"
            . "\x14\x00"       // version needed to extract (2.0)
            . "\x00\x00"       // general purpose flag
            . "\x00\x00"       // compression method: 0 = stored
            . pack('v', $dosTime)
            . pack('v', $dosDate)
            . pack('V', $crc)
            . pack('V', $size) // compressed size (== uncompressed, stored)
            . pack('V', $size) // uncompressed size
            . pack('v', $nameLen)
            . "\x00\x00"       // extra field length
            . $name;

        $out .= $localHeader . $bytes;

        $centralDir .= "PK\x01\x02"
            . "\x14\x00"       // version made by
            . "\x14\x00"       // version needed to extract
            . "\x00\x00"
            . "\x00\x00"
            . pack('v', $dosTime)
            . pack('v', $dosDate)
            . pack('V', $crc)
            . pack('V', $size)
            . pack('V', $size)
            . pack('v', $nameLen)
            . "\x00\x00"       // extra field length
            . "\x00\x00"       // file comment length
            . "\x00\x00"       // disk number start
            . "\x00\x00"       // internal file attributes
            . pack('V', 0100644 << 16) // external file attributes (unix -rw-r--r--)
            . pack('V', $offset)
            . $name;

        $offset += strlen($localHeader) + $size;
        $count++;
    }

    $centralDirOffset = $offset;
    $centralDirSize = strlen($centralDir);
    $eocd = "PK\x05\x06"
        . "\x00\x00"           // disk number
        . "\x00\x00"           // disk with central dir
        . pack('v', $count)    // entries on this disk
        . pack('v', $count)    // total entries
        . pack('V', $centralDirSize)
        . pack('V', $centralDirOffset)
        . "\x00\x00";          // comment length

    return $out . $centralDir . $eocd;
}

/** @return array{0:int,1:int} [DOS time, DOS date] for "now", the only timestamp a generated bulk-export ZIP needs. */
function zip_dos_datetime(): array
{
    $t = time();
    $time = (int) date('H', $t) << 11 | (int) date('i', $t) << 5 | ((int) date('s', $t) >> 1);
    $date = (max(0, (int) date('Y', $t) - 1980)) << 9 | (int) date('n', $t) << 5 | (int) date('j', $t);
    return [$time, $date];
}
