<?php
declare(strict_types=1);

// Hand-rolled UUIDv4 — MySQL's UUID() is v1 (time+MAC based), not a
// drop-in replacement for the v4 ids Postgres's gen_random_uuid() made
// throughout this schema, and pulling in ramsey/uuid would add a
// Composer dependency this project deliberately avoids for shared
// hosting portability.
function uuid4(): string
{
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // version 4
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // variant 10
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
