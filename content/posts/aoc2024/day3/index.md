---
publishDate: 2024-12-03
title: Day 3 - Mull It Over
author: Barr
keywords: [Advent of Code, Rust]
description: Parsing some basic instructions
summary: |
  Today's challange involves parsing and executing math instructions, surrounded by a lot of garbage data.
github: https://github.com/CattoFace/aoc2024/blob/main/src/day3.rs
---

## Clever But Not Faster
The input contains a string containing mostly garbage data, and some `mul(X,Y)` instructions, the goal is to find the instructions, multiply the numbers, and sum up all the multiplication results.

For the example input:
```
xmul(2,4)%&mul[3,7]!@^do_not_mul(5,5)+mul(32,64]then(mul(11,8)mul(8,5))
```
There are exactly 4 `mul` instructions: `mul(2,4)`, `mul(5,5)`, `mul(11,8)`, and `mul(8*5)`. So the answer is `2*4 + 5*5 + 11*8 + 8*5=161`

In my first attempt I already tried to be clever and use an algorithm inspired by the [Boyer–Moore algorithm](https://en.wikipedia.org/wiki/Boyer%E2%80%93Moore_string-search_algorithm).  
The idea was searching for a `)`, the last byte in a `mul` instruction, trying to parse the bytes before it, and on a failure, jump forward 7 bytes before searching again, since a mul instruction can't possibly end in the next 7 bytes.
The implementation for part 1 using this idea looks like this:
```rust
pub fn part1_backwards(mut input: &[u8]) -> u32 {
    const MINIMUM_SKIP: usize = 7;
    let mut sum = 0u32;
    loop {
        // no more room for instructions
        if input.len() < MINIMUM_SKIP {
            return sum;
        }
        match input[MINIMUM_SKIP..].iter().position(|&c| c == b')') {
            Some(i) => {
                // try to parse mul instruction
                let end_index = i + MINIMUM_SKIP;
                let (right_num, backwards_skip): (u16, usize) =
                    fast_parse_backwards(&input[..end_index]);
                // separating ','
                let mut read_head = end_index - backwards_skip - 1;
                if backwards_skip == 0 || input[read_head] != b',' {
                    input = &input[end_index + 1..];
                    continue;
                }
                let (left_num, backwards_skip): (u16, usize) =
                    fast_parse_backwards(&input[..read_head]);
                read_head -= backwards_skip;
                // verify its a mul
                if input[read_head - 4..read_head].eq(b"mul(") {
                    sum += left_num as u32 * right_num as u32;
                }
                input = &input[end_index + 1..];
            }
            None => return sum, // EOF
        }
    }
}
```
A little confusing with the index going backwards and forwards but it work and gives the correct solution, and the first star.  
Unfortunately, this is actually not as fast as I thought.  

I decided to compare my solution to a more naive solution:
```rust
pub fn part1_naive(mut input: &[u8]) -> u32 {
    const MINIMUM_INSTRUCTION_LENGTH: usize = 7;
    let mut sum = 0u32;
    while let Some(i) = input.array_windows().position(|s| s.eq(b"mul(")) {
        // no room for the rest of the instruction
        if i + MINIMUM_INSTRUCTION_LENGTH >= input.len() {
            break;
        }
        let start_index = i + 4;
        let (right_num, remainder): (u16, &[u8]) = fast_parse(&input[start_index..]);
        // check for separating ','
        if remainder.len() == input.len() - start_index || remainder[0] != b',' {
            input = &remainder[1..];
            continue;
        }
        let (left_num, remainder): (u16, &[u8]) = fast_parse(&remainder[1..]);
        // check for ending ')'
        if remainder[0] == b')' {
            sum += left_num as u32 * right_num as u32;
        }
        input = &remainder[1..];
    }
    sum
}
```

And this runs a lot faster...
```
Day3 - Part1/backwards  time:   [20.251 µs 20.456 µs 20.691 µs]
Day3 - Part1/naive      time:   [14.271 µs 14.324 µs 14.397 µs]
```
I'll get to optimize this further after part 2

## Part 2 - Control Instructions
Turns out the input also contains `do()` and `don't()` instructions, that enable and disable all future `mul` instructions(until changed again, enabled at start of input).  
For the  example input, that is similar to the first example:
```
xmul(2,4)&mul[3,7]!^don't()_mul(5,5)+mul(32,64](mul(11,8)undo()?mul(8,5))
```
Only 2 `mul` instructions are enabled now, so the result is `2*4 + 8*5=48`

My backwards solution for this is long and complicated but it works:
```rust
pub fn part2_backwards(mut input: &[u8]) -> u32 {
    const MINIMUM_SKIP_DISABLED: usize = 3;
    const MINIMUM_SKIP_ENABLED: usize = 6;
    let mut sum = 0u32;
    let mut enabled = true;
    loop {
        // no more room for instructions
        if input.len() < MINIMUM_SKIP_ENABLED {
            return sum;
        }
        if enabled {
            // search for disable or mul instructions
            match input[MINIMUM_SKIP_ENABLED..]
                .iter()
                .position(|&c| c == b')')
            {
                Some(i) => {
                    let end_index: usize = i + MINIMUM_SKIP_ENABLED;
                    // check for disable instruction
                    if input[end_index - 6..end_index].eq(b"don't(") {
                        enabled = false;
                    } else {
                        // try to parse mul instruction
                        let (right_num, backwards_skip): (u16, usize) =
                            fast_parse_backwards(&input[..end_index]);
                        // separating ','
                        let mut read_head = end_index - backwards_skip - 1;
                        if backwards_skip == 0 || input[read_head] != b',' {
                            input = &input[end_index + 1..];
                            continue;
                        }
                        let (left_num, backwards_skip): (u16, usize) =
                            fast_parse_backwards(&input[..read_head]);
                        read_head -= backwards_skip;
                        // verify its a mul
                        if input[read_head - 4..read_head].eq(b"mul(") {
                            sum += left_num as u32 * right_num as u32;
                        }
                        input = &input[end_index + 1..];
                    }
                }
                None => return sum, // EOF
            }
        } else {
            // search for enable instructions only
            match input[MINIMUM_SKIP_DISABLED..]
                .iter()
                .position(|&c| c == b')')
            {
                Some(i) => {
                    let end_index = i + MINIMUM_SKIP_DISABLED;
                    if input[end_index - 3..end_index].eq(b"do(") {
                        enabled = true;
                    }
                    input = &input[end_index + 1..];
                }
                None => return sum, // EOF
            }
        }
    }
}
```

The idea is that it switches between 2 modes:

- Look for `don't()` and `mul` instructions.
- Look for `do()` instructions.

Each mode has its own skip distance for the shortest possible instruction, and `do()` and `don't()` toggle between the modes.

The time for this solution is:
```
Day3 - Part2/backwards  time:   [22.076 µs 22.204 µs 22.420 µs]
```

I didn't write a naive solution for part 2, instead I rewrote it using optimizations from part 1 at the end.

## Even Faster Part 1
The only optimization I applied to the naive solution for part 1 is using the `memchr` crate for finding the instructions:
```rust {hl_lines=[4]}
fn sum_muls<'a>(mut input: &'a [u8], finder: &Finder) -> (u32, &'a [u8]) {
    const MINIMUM_INSTRUCTION_LENGTH: usize = 7;
    let mut sum = 0u32;
    while let Some(i) = finder.find(input) {
        // no more room for instructions
        if i + MINIMUM_INSTRUCTION_LENGTH >= input.len() {
            break;
        }
        let start_index = i + 4;
        let (right_num, remainder): (u16, &[u8]) = fast_parse(&input[start_index..]);
        if remainder.len() == input.len() - start_index || remainder[0] != b',' {
            input = &remainder[1..];
            continue;
        }
        let (left_num, remainder): (u16, &[u8]) = fast_parse(&remainder[1..]);
        if remainder[0] == b')' {
            sum += left_num as u32 * right_num as u32;
        }
        input = &remainder[1..];
    }
    (sum, input)
}

#[aoc(day3, part1, memchr)]
// optimized version of part1_naive that uses memchr::memmem instead of iter::position
pub fn part1_memchr(input: &[u8]) -> u32 {
    let finder = memmem::Finder::new(b"mul(");
    sum_muls(input, &finder).0
}
```
I separated most of the code to a new function because I want to use it for the optimized part 2 while reusing a `memmem:Finder`, instead of recreating it every call.

This version is a little faster:
```
Day3 - Part1/naive      time:   [14.271 µs 14.324 µs 14.397 µs]
Day3 - Part1/memchr     time:   [13.470 µs 13.500 µs 13.532 µs]
```

Now it's time to optimize part 2:

## Rewriting Part 2

This algorithm was inspired by someone else's solution.
This time I am parsing `mul` instructions in chunks between `do()` and `don't()` instructions, the general steps are:

- Find the next `don't()`
- Execute `mul`s until the found `don't`
- Find the next `do()` and skip to just after it.
- Repeat
```rust
pub fn part2_memchr(mut input: &[u8]) -> u32 {
    const DO_SIZE: usize = 4;
    const DONT_SIZE: usize = 7;
    let mut sum = 0u32;
    let mul_finder = Finder::new("mul(");
    let do_finder = Finder::new("do()");
    let dont_finder = Finder::new("don't()");
    loop {
        match dont_finder.find(input) {
            Some(dont_idx) => {
                let (s, _) = sum_muls(&input[..dont_idx], &mul_finder);
                sum += s;
                let remainder = &input[DONT_SIZE + dont_idx..];
                match do_finder.find(remainder) {
                    Some(do_idx) => input = &remainder[DO_SIZE + do_idx..],
                    None => return sum,
                }
            }
            None => {
                let (s, _) = sum_muls(input, &mul_finder);
                sum += s;
                return sum;
            }
        }
    }
}
```

This algorithm does read every byte in the `do` sections twice, but turns out it's worth it:
```
Day3 - Part2/backwards  time:   [22.076 µs 22.204 µs 22.420 µs]
Day3 - Part2/memchr     time:   [11.629 µs 11.642 µs 11.661 µs]
```
This is a lot faster than even the fastest part 1 solution!

## Even Faster Parsing
Looking at a [flamegraph](slow_parse.svg) of part 1, it looks like 72% of the time is spent parsing, so I decided to try to make it even faster.
I wrote a new implementation for parsing specifically `u16` that are up to 3 digits long, since that is what's required for the given input.
```rust
fn fast_parse(input: &[u8]) -> (u16, &[u8]) {
    match input.first() {
        None => (0, input),
        Some(&i) => {
            let i = i as u16;
            match input.get(1) {
                None => (i, &input[1..]),
                Some(&j) => {
                    let j = j as u16;
                    match input.get(2) {
                        None => (i * 10 + j, &input[2..]),
                        Some(&k) => (i * 100 + j * 10 + k as u16, &input[3..]),
                    }
                }
            }
        }
    }
}
```
This parser is considerably faster:
```
Day3 - Part1/memchr(OLD) time:   [13.470 µs 13.500 µs 13.532 µs]
Day3 - Part1/memchr      time:   [9.9806 µs 9.9937 µs 10.007 µs]

Day3 - Part2/memchr(OLD) time:   [11.629 µs 11.642 µs 11.661 µs]
Day3 - Part2/memchr      time:   [5.4157 µs 5.4258 µs 5.4383 µs]
```
And those are my final times for the day.

## End Of Day 3
I tried to be clever with today's challenge but it wasn't worth it at all, maybe I should go back to starting with the naive solution.
