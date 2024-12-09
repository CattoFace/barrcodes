---
publishDate: 2024-12-09
title: Day 9 - Disk Fragmenter
author: Barr
keywords: [Advent of Code, Rust]
description: Defragmenting a disk? Finally something that sounds programming related.
summary: |
  An elf is trying to compact the files on his computer.
github: https://github.com/CattoFace/aoc2024/blob/main/src/day9.rs
---
## Input
The input is a single line consisting of a list of a 1 digit size, alternating between a file and empty space, each file also has an ID, given in increasing order(empty spaces are not given an ID).

## Part 1
The elf wants to compact all the files to once contiguous space, that's not "defragmenting", but I guess I'll help.  
The output of the program needs to be a "checksum" of the disk: a sum of each index in the disk multiplied by the ID of the file in it(if there is one).  
As always, the first solution should be the most naive one:
```rust
const EMPTY_FILE: u32 = u32::MAX;

fn build_disk(input: &[u8]) -> Vec<u32> {
    let mut last_id = 0u32;
    // create disk
    let mut disk = input
        .array_chunks()
        .enumerate()
        .flat_map(|(id, pair): (usize, &[u8; 2])| {
            let id = id as u32;
            let filled = (pair[0] - b'0') as usize;
            let empty = (pair[1] - b'0') as usize;
            last_id = id;
            repeat_n(id, filled).chain(repeat_n(EMPTY_FILE, empty))
        })
        .collect::<Vec<u32>>();
    // adding the last block
    if input.len() % 2 != 0 {
        disk.extend(repeat_n(
            last_id + 1,
            (input[input.len() - 1] - b'0') as usize,
        ));
    }
    disk
}

fn compact_disk(disk: &mut [u32]) {
    let mut empty_location = disk.iter().position(|&id| id == EMPTY_FILE).unwrap();
    let mut filled_location = disk.len() - 1;
    while empty_location < filled_location {
        disk.swap(empty_location, filled_location);
        empty_location = disk.iter().position(|&id| id == EMPTY_FILE).unwrap();
        filled_location =
            disk.len() - 1 - disk.iter().rev().position(|&id| id != EMPTY_FILE).unwrap();
    }
}

fn checksum(disk: &[u32]) -> u64 {
    disk.iter()
        .take_while(|&&id| id != EMPTY_FILE)
        .enumerate()
        .map(|(index, &id)| index as u64 * id as u64)
        .sum::<u64>()
}

#[aoc(day9, part1, first)]
pub fn part1_first(input: &[u8]) -> u64 {
    let mut disk = build_disk(input);
    compact_disk(&mut disk);
    checksum(&disk)
}
```
I decided to fully expand the input into the disk size, filling the ID of each file into it's location or `EMPTY_FILE`(`u32::MAX`, since `0` is a valid ID) into empty space.  
The process is fairly simple with this design:

1. Expand input into disk
2. Find empty space and filled space and swap until the earliest empty space is after the last filled space.
3. Calculate checksum.

There are many flaws and improvements to this solution, I'll get back to it after part 2.

## Part 2
The elf has figured out the adding fragmentation is not a good idea, so now I need to only compact files when it wont fragment them, meaning only move entire files at once.  
In reality the actual requirements leave some files not fully packed, the exact requirements are(some undocumented, but understandable from the example):

- Starting from the back, each file must be moved to the earliest location it can fit it.
- Once a file has been checked and was not moved, it will not move even if a place opened up(undocumented).

This time, I must keep the parts of the files together, and not expand them into the individual locations, this is more efficient in general but more complicated to work with.  
After a lot of debugging I came up with this solution:
```rust
fn build_mini_disk(input: &[u8]) -> Vec<(u32, u8)> {
    let mut last_id = 0u32;
    // build disk
    let mut disk = input
        .array_chunks()
        .enumerate()
        .flat_map(|(id, pair): (usize, &[u8; 2])| {
            let id = id as u32;
            let filled = pair[0] - b'0';
            let empty = pair[1] - b'0';
            last_id = id;
            [(id, filled), (EMPTY_FILE, empty)]
        })
        .filter(|chunk| chunk.1 != 0)
        .collect::<Vec<(u32, u8)>>();
    disk.push((last_id + 1, (input[input.len() - 1] - b'0')));
    disk
}

fn compact_mini_disk2(disk: &mut Vec<(u32, u8)>) {
    // last file always not empty
    let mut read_head = disk.len() - 1;
    loop {
        // try to find empty location to move file at read_head
        if let Some(write_head) = disk[..read_head].iter().position(|potential_file| {
            potential_file.0 == EMPTY_FILE && disk[read_head].1 <= potential_file.1
        }) {
            // swap into empty file
            let empty_size = disk[write_head].1;
            let read_size = disk[read_head].1;
            disk.swap(read_head, write_head);
            disk[read_head].1 = read_size;
            // reinsert smaller empty file if needed
            if read_size < empty_size {
                disk.insert(write_head + 1, (EMPTY_FILE, empty_size - read_size));
                read_head += 1;
            }
        }
        // find new potential file to move
        if let Some(next_read) = disk[..read_head]
            .iter()
            .rev()
            .position(|file| file.0 != EMPTY_FILE)
        {
            read_head = read_head - 1 - next_read;
        } else {
            return;
        }
    }
}

fn checksum_mini(disk: &[(u32, u8)]) -> u64 {
    disk.iter()
        .fold((0u64, 0u64), |(location, checksum), &(id, size)| {
            let new_location = location + size as u64;
            let new_checksum = if id == EMPTY_FILE {
                checksum
            } else {
                checksum + (location..new_location).sum::<u64>() * id as u64
            };
            (new_location, new_checksum)
        })
        .1
}

#[aoc(day9, part2, first)]
pub fn part2_first(input: &[u8]) -> u64 {
    let mut mini_disk = build_mini_disk(input);
    compact_mini_disk2(&mut mini_disk);
    checksum_mini(&mini_disk)
}
```
The building of the "mini disk" and calculating it's checksum are fairly straight forward.  
To compact the disk, I go through every file from back to front, and try to find areas from the front that can fit the file, if a place is found, I might only need to take up some of it, so I create a new smaller empty file after the existing empty one, and replace the empty one with the file that I'm moving.  
If the empty space is exactly the right size, no new empty file is needed.  

This solution needed a ton of debugging, but eventually I got it.

## Optimizations
I have some ideas how to improve part 2, but I don't have the time for that, maybe someone else will take the ideas I applied to part 1 and apply them to part 2.  
Initial times(with the CPU clock locked to `2.6Ghz`):
```
Day9 - Part1/first      time:   [644.46 ms 644.82 ms 645.30 ms]
Day9 - Part2/first      time:   [65.304 ms 65.403 ms 65.503 ms]
```
This part 2 speed is not great, but the part 1 speed is just terrible.

I initially thought about rewriting part 1 to keep files together like in part 2, but then I realize I don't even need that.  
Since I don't need to scan front to back for empty space multiple times, I can iterate through it only once.  
Combined with iterating back to front for the files to move, this is exactly a double ended queue.  
So my new solution builds the "mini disk" into a double ended queue, and a new function that calculates the checksum while "moving files", consumes it:
```rust
fn checksum_skip_compact(mut disk: VecDeque<(u32, u8)>) -> u64 {
    let mut checksum = 0u64;
    let mut read = 0u64;
    let mut front = disk.pop_front().unwrap();
    let mut back = disk.pop_back().unwrap();
    loop {
        if front.0 != EMPTY_FILE {
            checksum += (read..read + front.1 as u64).sum::<u64>() * front.0 as u64;
            read += front.1 as u64;
            front = if let Some(f) = disk.pop_front() {
                f
            } else {
                return checksum;
            }
        } else {
            match front.1.cmp(&back.1) {
                // less empty than there is to fill
                Ordering::Less => {
                    checksum += (read..read + front.1 as u64).sum::<u64>() * back.0 as u64;
                    read += front.1 as u64;
                    back.1 -= front.1;
                    front = if let Some(f) = disk.pop_front() {
                        f
                    } else {
                        checksum += (read..read + back.1 as u64).sum::<u64>() * back.0 as u64;
                        return checksum;
                    };
                }
                // exact size to fill
                Ordering::Equal => {
                    checksum += (read..read + back.1 as u64).sum::<u64>() * back.0 as u64;
                    read += back.1 as u64;
                    front = if let Some(f) = disk.pop_front() {
                        f
                    } else {
                        checksum += (read..read + back.1 as u64).sum::<u64>() * back.0 as u64;
                        return checksum;
                    };
                    back = if let Some(f) = disk.pop_back() {
                        f
                    } else {
                        return checksum;
                    };
                    while back.0 == EMPTY_FILE {
                        back = if let Some(f) = disk.pop_back() {
                            f
                        } else {
                            return checksum;
                        };
                    }
                }
                // more empty than there is to fill
                Ordering::Greater => {
                    checksum += (read..read + back.1 as u64).sum::<u64>() * back.0 as u64;
                    read += back.1 as u64;
                    front.1 -= back.1;
                    back = if let Some(f) = disk.pop_back() {
                        f
                    } else {
                        return checksum;
                    };
                    while back.0 == EMPTY_FILE {
                        back = if let Some(f) = disk.pop_back() {
                            f
                        } else {
                            return checksum;
                        };
                    }
                }
            }
        }
    }
}
```
Because I'm keeping files in single pieces, I need to handle a lot of cases about the various size differences.  
This solution could be seen as  similar to the original part 1 with these differences:

- It doesn't actually move the files, since they are not needed later.
- It works with entire files, moving parts of them at a time(or the entire file, making the empty space smaller)
- It calculates checksum while "compacting"

And the new time is:
```
Day9 - Part1/skip       time:   [194.71 µs 194.99 µs 195.35 µs]
```
That's a 3000x speedup, I'll take it.

## Final Times
