---
publishDate: 2024-12-17
title: Day 17 - Chronospatial Computer
author: Barr
keywords: [Advent of Code, Rust]
description: A simple interpreter, until it isnt.
summary: |
  Part 1 has gives a simple program to interpret, part 2 makes it a lot harder.
github: https://github.com/CattoFace/aoc2024/blob/main/src/day17.rs
---
## Input
The input is a short text giving the starting value of 3 registers, and a set of instructions to execute, for example:
```
Register A: 729
Register B: 0
Register C: 0

Program: 0,1,5,4,3,0
```
Each instruction is a pair of an opcode followed by an operand.  
The exact behavior of each instruction is given in detail in the [problem description](https://adventofcode.com/2024/day/17).  
The 2 notable instructions are the conditional jump(opcode 3), and the print(opcode 5)

## Part 1
The goal in part 1 is to find out what the program prints.  
I wrote a simple interpreter for it that returns the next instruction pointer:
```rust
fn execute_instruction(
    instruction_pointer: usize,
    opcode: usize,
    operand: usize,
    memory: &mut [usize; 7],
    output: &mut Vec<u8>,
) -> usize {
    match opcode {
        0 => memory[4] >>= memory[operand],
        1 => memory[5] ^= operand,
        2 => memory[5] = memory[operand] % 8,
        3 => {
            if memory[4] != 0 {
                return operand;
            }
        }
        4 => memory[5] ^= memory[6],
        5 => {
            output.push((memory[operand] % 8) as u8 + b'0');
            output.push(b',');
        }
        6 => memory[5] = memory[4] >> memory[operand],
        7 => memory[6] = memory[4] >> memory[operand],
        _ => unreachable!("invalid program"),
    }
    instruction_pointer + 2
}

```
And all that's left is to parse the input and feed the interpreter on a loop until the program ends:
```rust
pub fn part1_first_inner(input: &[u8]) -> Vec<u8> {
    // setup
    let (reg_a, remainder) = fast_parse(&input[12..]);
    let mut output = Vec::new();
    let mut memory = [0usize, 1, 2, 3, reg_a, 0, 0];
    let instructions: Vec<usize> = remainder[39..]
        .iter()
        .filter_map(|&c| {
            if c != b',' {
                Some((c - b'0') as usize)
            } else {
                None
            }
        })
        .collect();
    let mut instruction_pointer = 0usize;
    // execution loop
    while instruction_pointer < instructions.len() {
        instruction_pointer = execute_instruction(
            instruction_pointer,
            instructions[instruction_pointer],
            instructions[instruction_pointer + 1],
            &mut memory,
            &mut output,
        );
    }
    output.pop(); // don't want last comma
    output
}
```

## Part 2
Part 2 asks for the starting value of register A that will cause the instructions to print themselves.  
I first tried writing a *reverse* interpreter that will read the instructions in reverse order and undo the actions each instruction is supposed to do, but turns out the instruction set, and specifically, the patterns of instructions in the input, are too destructive for this approach to work.  

Unfortunately, today also requires looking directly at the input looking for assumptions that can help:

- Turns out every input ends with a `jnz A,0` instruction, meaning "repeat the whole program if A is not 0", and no other jumps.  
- Every iteration read the bottom 3 bits of A, and later shift A right by 3 bits.instruction.
- A few more bits from A will be read, and a few XOR operations will be done that involve that B and C registers(but never A), and at some point there will be a single print from B or C.
- This means A is never written to, and it's bottom 3 bits are removed at each iteration.  

Using these assumptions, one can work in reverse, guess random A values for the last iterations and see which ones print the last instruction operand, and then guess random A values and see which ones print the last instruction opcode, and leads to one of the A values that later printed the last operand, and so on.

Actually, guessing completely random A values is not necessary, it's possible to do it the other way: guess A values out of the ones whose bits before the lowest 3, printed the correct value in the previous iteration(next iteration in real execution, since it's going backwards).

And finally, at least in inputs I've seen, only the bottom 11 bits of A can affect the output, so I decided to pre-calculate all of them to use when actually testing different A values.

### Implementing The Solution
The start is the same as part 1, except parsing A is not needed, since it is not the A that is required.  
Then, I pre-calculated all possible input-output pairs for a single iteration of the instructions:
```rust
let output_table: Vec<_> = (0usize..TABLE_SIZE)
    .map(|a| {
        let mut memory = [0usize, 1, 2, 3, a, 0, 0];
        for &[opcode, operand] in instructions[..instructions.len() - 2].array_chunks() {
            match opcode {
                0 => memory[4] >>= memory[operand],
                1 => memory[5] ^= operand,
                2 => memory[5] = memory[operand] % 8,
                4 => memory[5] ^= memory[6],
                5 => return memory[operand] % 8,
                6 => memory[5] = memory[4] >> memory[operand],
                7 => memory[6] = memory[4] >> memory[operand],
                _ => unreachable!("invalid program"),
            }
        }
        unreachable!()
    })
    .collect();
```
This version of the interpreter already incorporates the assumptions into it's implementation, it doesn't even read the last instruction.  

The next step is to create the starting set of possible A values that can print the last instruction operand:
```rust
let mut possible_a: Vec<_> = output_table
    .iter()
    .enumerate()
    .filter_map(|(a, &out)| {
        if out == instructions[instructions.len() - 1] {
            Some(a)
        } else {
            None
        }
    })
    .collect();
```

And finally, for each number in the instruction, this `possible_a` vector is rebuilt from the previous `possible_a` vector being converted to the possible A values that can become one of the previous `possible_a` values **and** print the number:
```rust
for &to_output in instructions[..instructions.len() - 1].iter().rev() {
    possible_a = possible_a
        .into_iter()
        .flat_map(|full_a| {
            let prev_low_a = full_a % (TABLE_SIZE / 8);
            output_table[prev_low_a * 8..(prev_low_a + 1) * 8]
                .iter()
                .enumerate()
                .filter_map(move |(new_a, &output)| {
                    if output == to_output {
                        Some(full_a * 8 + new_a % 8)
                    } else {
                        None
                    }
                })
        })
        .collect();
}
```
Turns out this method can return multiple possible A values after it finishes, so I simply returned the first one(which is always the smallest one), and it worked.

## Optimizations
Starting times:
```
Day17 - Part1/(default) time:   [428.60 ns 428.89 ns 429.21 ns]
Day17 - Part2/table     time:   [1.1985 ms 1.2088 ms 1.2193 ms]
```

I first tried rewriting part 1 using the assumptions that I found in part 2:
```rust
while memory[4] != 0 {
        for &[opcode, operand] in instructions[..instructions.len() - 2].array_chunks() {
            match opcode {
                0 => memory[4] >>= memory[operand],
                1 => memory[5] ^= operand,
                2 => memory[5] = memory[operand] % 8,
                4 => memory[5] ^= memory[6],
                5 => {
                    output.push((memory[operand] % 8) as u8 + b'0');
                    output.push(b',');
                }
                6 => memory[5] = memory[4] >> memory[operand],
                7 => memory[6] = memory[4] >> memory[operand],
                _ => unreachable!("invalid program"),
            }
        }
    }
```
This loop replaces the original loop that called `execute_instruction`.

For some reason I can't explain, this is *slower*:
```
Day17 - Part1/opt       time:   [456.74 ns 456.99 ns 457.24 ns]
```

The next thing I tested was solving part 2 without the table, simply running all the instruction every time I would have checked the table:
```rust
let mut possible_a: Vec<_> = (0..TABLE_SIZE)
    .filter(|&a| {
        let mut memory = [0usize, 1, 2, 3, a, 0, 0];
        for &[opcode, operand] in instructions[..instructions.len() - 2].array_chunks() {
            match opcode {
                0 => memory[4] >>= memory[operand],
                1 => memory[5] ^= operand,
                2 => memory[5] = memory[operand] % 8,
                4 => memory[5] ^= memory[6],
                5 => return memory[operand] % 8 == instructions[instructions.len() - 1],
                6 => memory[5] = memory[4] >> memory[operand],
                7 => memory[6] = memory[4] >> memory[operand],
                _ => unreachable!("invalid program"),
            }
        }
        unreachable!()
    })
    .collect();
for &to_output in instructions[..instructions.len() - 1].iter().rev() {
    possible_a = possible_a
        .into_iter()
        .flat_map(|full_a| {
            (full_a * 8..(full_a + 1) * 8).filter(|&a| {
                let mut memory = [0usize, 1, 2, 3, a, 0, 0];
                for &[opcode, operand] in instructions[..instructions.len() - 2].array_chunks()
                {
                    match opcode {
                        0 => memory[4] >>= memory[operand],
                        1 => memory[5] ^= operand,
                        2 => memory[5] = memory[operand] % 8,
                        4 => memory[5] ^= memory[6],
                        5 => return memory[operand] % 8 == to_output,
                        6 => memory[5] = memory[4] >> memory[operand],
                        7 => memory[6] = memory[4] >> memory[operand],
                        _ => unreachable!("invalid program"),
                    }
                }
                unreachable!()
            })
        })
        .collect();
}
```

Turns out reusing the table saves a ton of time, even if I'm spending a long time generating it:
```
Day17 - Part2/table     time:   [1.1985 ms 1.2088 ms 1.2193 ms]
Day17 - Part2/no_table  time:   [12.983 ms 13.005 ms 13.040 ms]
```

So no improvements today.  

## Final Times
Unlocking the CPU clock:
```
Day17 - Part1/(default) time:   [267.57 ns 267.77 ns 268.01 ns]
Day17 - Part2/table     time:   [705.74 µs 706.17 µs 706.58 µs]
```
The fastest part 1 time so far, along with one of the slowest part 2 time.
