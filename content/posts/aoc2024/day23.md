---
publishDate: 2024-12-23
title: Day 23 - LAN Party
author: Barr
keywords: [Advent of Code, Rust]
description: Finding cliques in graphs
summary: |
  Today's challange is about finding cliques in a graph constructed from a list of edges, that together make up a computer network.
github: https://github.com/CattoFace/aoc2024/blob/main/src/day23.rs
---
## Input
Each line in the input is a single edge between 2 computers, for example:
```
kh-tx
```
Connects the computers `kh` and `tc`.  
The created graph is undirected.

## Part 1
The chief historian's(which we're are still looking for, 23 days in) computer's name stars with `t`, so I need to look for groups of 3 computers connected together(that's what makes a LAN party apparently), where at least one of them starts with `t`.  
The output is the amount of groups that match this requirement.

I first parsed the graph into an array of neighbours vectors:
```rust
let mut neighbours: [Vec<usize>; 26 * 26] = from_fn(|_| Default::default());
input.chunks(6).for_each(|line: &[u8]| {
    // rotate letters to make t the smallest, for de-duplication later
    let c11 = if line[0] < b't' {
        line[0] + 26 - b't'
    } else {
        line[0] - b't'
    };
    let c12 = if line[1] < b't' {
        line[1] + 26 - b't'
    } else {
        line[1] - b't'
    };
    let c21 = if line[3] < b't' {
        line[3] + 26 - b't'
    } else {
        line[3] - b't'
    };
    let c22 = if line[4] < b't' {
        line[4] + 26 - b't'
    } else {
        line[4] - b't'
    };
    let comp1 = c11 as usize * 26 + c12 as usize;
    let comp2 = c21 as usize * 26 + c22 as usize;
    // as a de-duplication policy, connections will be increasing IDs
    if comp1 <= comp2 {
        neighbours[comp1].push(comp2);
    } else {
        neighbours[comp2].push(comp1);
    }
});
```
To de-duplicate groups later, I only connect the computers in one direction, from the lower value one to the higher value one, and since I will be iterating over the ones that start with `t`, I reordered the alphabet to put `t` first.

Next I iterate over the computers that start with `t`, and their neighbours, to find a 3rd neighbour that is also a neighbour of the first computer(that starts with `t`):
```rust
for (comp1, neighs) in neighbours[..26].iter().enumerate() {
    for &comp2 in neighs {
        let neighs2 = &neighbours[comp2];
        for &comp3 in neighs2 {
            if neighbours[comp1].contains(&comp3) {
                count += 1;
            }
        }
    }
}
```
Because of the one directional connections, if a group exists, the first computer will be a neighbour of the other 2, the 2nd will be a neighbour of the 3rd, and the 3rd will not have either of the as a neighbour.  
This means each group will only be detected in 1 order, and prevent counting it more than once.

## Part 2
Now the goal is finding the biggest group of fully connected computers(a [clique](https://en.wikipedia.org/wiki/Clique_(graph_theory))), and printing the names of a computers in ascending alphabetical order.  
Searching on Google I found the [Bron-Kerbosch](https://en.wikipedia.org/wiki/Bron%E2%80%93Kerbosch_algorithm) algorithm, and implemented it:
```rust
fn bron_kerbosch(
    included: &mut FxHashSet<usize>,
    mut potential: FxHashSet<usize>,
    mut rejected: FxHashSet<usize>,
    neighbours: &[FxHashSet<usize>; 26 * 26],
) -> FxHashSet<usize> {
    if potential.is_empty() && rejected.is_empty() {
        return included.clone();
    }
    let mut max_set: FxHashSet<usize> = Default::default();
    let curr_potential = potential.clone();
    for &vertex in curr_potential.iter() {
        included.insert(vertex);
        let s = bron_kerbosch(
            included,
            potential
                .intersection(&neighbours[vertex])
                .copied()
                .collect(),
            rejected
                .intersection(&neighbours[vertex])
                .copied()
                .collect(),
            neighbours,
        );
        included.remove(&vertex);
        if s.len() > max_set.len() {
            max_set = s;
        }
        potential.remove(&vertex);
        rejected.insert(vertex);
    }
    max_set
}
```
The outer function calls it like so:
```rust
    let potential = neighbours
        .iter()
        .enumerate()
        .filter_map(|(i, n)| if n.is_empty() { None } else { Some(i) })
        .collect();
    let max_set = bron_kerbosch(
        &mut Default::default(),
        potential,
        Default::default(),
        &neighbours,
    );
    max_set
        .iter()
        .sorted()
        .map(|&comp| {
            String::from_utf8([(comp / 26) as u8 + b'a', (comp % 26) as u8 + b'a'].to_vec())
                .unwrap()
        })
        .join(",")
```
The neighbours are added both ways this time and I'm no longer putting `t` at the start of the alphabet.

## Optimizations
Starting runtime:
```
Day23 - Part1/(default) time:   [69.748 µs 70.336 µs 71.405 µs]
Day23 - Part2/(default) time:   [53.423 ms 53.521 ms 53.622 ms]
```
I've tried using HashMaps in part 1 instead of vectors, and find the groups using this code:
```rust
for neighs in &neighbours[..26] {
    for &comp2 in neighs {
        count += neighs.intersection(&neighbours[comp2]).count();
    }
}
```
And it ended up being slower.

But part 2 can get a lot faster:

The first thing I tried was removing the `rejected` set, since it is not actually required for the algorithm, it's meant to save time checking unnecessary `included` sets, but turns out that with so many allocations, *removing* it is a lot faster:
```
Day23 - Part2/(default) time:   [21.338 ms 21.386 ms 21.434 ms]
```
Next, `included` doesn't actually need to be a set, a vector works just as well and makes it faster:
```
Day23 - Part2/(default) time:   [15.181 ms 15.243 ms 15.323 ms]
```

And finally, turns out a very naive algorithm that doesn't do a huge amount of allocations is a lot faster:  
First, it appears that the max clique size is always 13, so the goal is finding the vertices that form it.  
Additionally, the simplest way to find a clique is to take any 13 vertices, and for every pair in that group, verify they share an edge.  
Taking just *any* 13 will be slow, so I started by iterating over the vertices, and looked for ones with at least 12 neighbours.  
The full function looks like this:
```rust
fn brute_force_clique(neighbours: [FxHashSet<usize>; 26 * 26]) -> Vec<usize> {
    for (c1, n1) in neighbours.iter().enumerate() {
        // looking specifically for cliques of size 13, vertices with less than 12 neighbours are
        // irrelevant
        if n1.len() < 12 {
            continue;
        }
        // iterate over all combinations of 12 neighbours
        let potential_cliques = n1
            .iter()
            .filter(|n| neighbours[**n].len() >= 12)
            .copied()
            .combinations(12);
        for mut pc in potential_cliques {
            // check if the current combination forms a clique
            if pc
                .iter()
                .tuple_combinations()
                .all(|(a, b)| neighbours[*a].contains(b))
            {
                pc.push(c1);
                return pc;
            }
        }
    }
    unreachable!()
}
```

This implementation is surprisingly fast:
```
Day23 - Part2/brute_force time:   [198.98 µs 200.28 µs 202.85 µs]
```
