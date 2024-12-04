---
publishDate: 2024-12-04
title: Day 4 - Ceres Search
author: Barr
keywords: [Advent of Code, Rust]
description: Going 2 dimensional - a word search
summary: |
  Seems like these challanges mostly don't involve searching for this missing historian(does anyone even notice the lore for these?), today we've got an elf looking for help with her word search.
github: https://github.com/CattoFace/aoc2024/blob/main/src/day4.rs
---
## Part 1
The task for part 1 is simple: given a grid of letters, find all occurrences of `XMAS`, forwards, backwards, up, down, and diagonal.
I learned from yesterday, and I'll start with a naive solution:
```rust
fn find_surrounding_mas(input: &[u8], i: usize, line_len: usize) -> u32 {
    // LEFT
    (i>=3 && &input[i-3..i]==b"SAM") as u32+
    // RIGHT
    (i<=input.len()-3 && &input[i+1..i+4]==b"MAS") as u32+
    // UP
    (i>=3*line_len
        && input[i-3*line_len] == b'S'
        && input[i-2*line_len] == b'A'
        && input[i-line_len] == b'M') as u32 +
    // UP+RIGHT
    (i+3>=3*line_len
    && input[i+3-3*line_len] == b'S'
    && input[i+2-2*line_len] == b'A'
    && input[i+1-line_len] == b'M') as u32 +
    // UP+LEFT
    (i>=3*line_len+3
        && input[i-3*line_len-3] == b'S'
        && input[i-2*line_len-2] == b'A'
        && input[i-line_len-1] == b'M') as u32 +
    //DOWN
    (i+3*line_len<input.len()
        && input[i+3*line_len] == b'S'
        && input[i+2*line_len] == b'A'
        && input[i+line_len] == b'M') as u32 +
    //DOWN+RIGHT
    (i+3*line_len+3<input.len()
        && input[i+3*line_len+3] == b'S'
        && input[i+2*line_len+2] == b'A'
        && input[i+line_len+1] == b'M') as u32 +
    // DOWN+LEFT
    (i+3*line_len-3<input.len()
        && input[i+3*line_len-3] == b'S'
        && input[i+2*line_len-2] == b'A'
        && input[i+line_len-1] == b'M') as u32
}

pub fn part1(input: &[u8]) -> u32 {
    let line_len = memchr::memchr(b'\n', input).unwrap() + 1;
    memchr::memchr_iter(b'X', input)
        .map(|i| find_surrounding_mas(input, i, line_len))
        .sum::<u32>()
}
```
I'm just looking all the `X`s in the input(using `memchr` which I introduced [yesterday](/posts/aoc2024/day1/), could have also used a simple `position`), and then checking their surroundings.

The only issues I had was bounds checking mistakes, I first tried fixing them with checked `input.get()`, but the index could underflow anyway, so I didn't use it.

This solution solves part 1 and its time for part 2.

## Part 2
Of course, the instructions given in part 1 were wrong, this is not an `XMAS` search, it's an `X-MAS` search, meaning I need to find X patterns of the word `MAS`, for example:
```
M.M
.A.
S.S
```
The `.` are other irrelevant letters, of course each `MAS` can be forwards or backwards.  
To me this seems even easier than part 1:
```rust
fn is_x(input: &[u8], i: usize, line_len: usize) -> bool {
    // UPLEFT+DOWNRIGHT
    ((input.get(i - line_len - 1) == Some(&b'M') && input.get(i + line_len + 1) == Some(&b'S'))
        || (input.get(i - line_len - 1) == Some(&b'S') && input.get(i + line_len + 1) == Some(&b'M'))) &&
    // DOWNLEFT+UPRIGHT
    ((input.get(i + line_len - 1) == Some(&b'M') && input.get(i - line_len + 1) == Some(&b'S'))
        || (input.get(i + line_len - 1) == Some(&b'S') && input.get(i - line_len + 1) == Some(&b'M')))
}
pub fn part2(input: &[u8]) -> u32 {
    let line_len = memchr::memchr(b'\n', input).unwrap() + 1;
    // no point searching in the first and last line
    // there's also no point searching the first and last column but that's not worth the effort to skip
    memchr::memchr_iter(b'A', &input[line_len..input.len() - line_len])
        .filter(|&i| is_x(input, i + line_len, line_len))
        .count() as u32
}
```
Find all the `A`s, check their surroundings, and part 2 is done.

## Failed Optimization
The initial times:
```
Day4 - Part1/naive time:   [79.028 µs 79.312 µs 79.645 µs]
Day4 - Part2/naive time:   [61.799 µs 61.944 µs 62.133 µs]
```

The only optimization I can think of is using `memchr::memmem` to replace the right and left checks:
```rust
let forwards = find_iter(input, "XMAS").count() as u32;
let backwards = find_iter(input, "SAMX").count() as u32;
let line_len = memchr::memchr(b'\n', input).unwrap() + 1;
let other: u32 = memchr::memchr_iter(b'X', input[line_len..input.len() - line_len])
    .map(|i| find_surrounding_mas(input, i+lin, line_len))
    .sum();
forwards + backwards + other
```
The right and left checks were removed from `find_surrounding_mas`.
```
Day4 - Part1/naive  time:   [79.028 µs 79.312 µs 79.645 µs]
Day4 - Part1/memmem time:   [102.43 µs 102.75 µs 103.08 µs]
```
Turns out its slower...

I also tried replacing all the indexing inside `find_surrounding_mas` with unsafe `get_unchecked` but it was also slower (~86us).

## End of Day 4
I guess this is it for the day, I could not think of many optimizations and the ones I did try did not work.

