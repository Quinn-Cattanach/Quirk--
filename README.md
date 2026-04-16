# Quirk--

A graphical, web-based _noisy_ quantum circuit simulator inspired by Quirk.

# Quick Setup Guide

First build the simulator. Use the provided `build.sh` because this project uses `ts-rs`. `ts-rs` generates bindings with `cargo test`. 
```
cd simulator
chmod a+x ./build.sh
./build.sh
```

You can then run the frontend:
```
cd ui
npm install
npm run dev
```

# Simulator

I'm setting up a basic simulator using the ,

I think we should approach error simulation by: simulate perfect circuit, simulate with noise (let's make sure we parameterize the noise), and then compute fidelity https://en.wikipedia.org/wiki/Fidelity_of_quantum_states. 

lmk if you have a better measure you think we should use.

Running:
```
cd simulator
cargo test
```

## Simulation:


# UI

TODO.

I'm happy to just do this. But if you would like to learn and work on this too, I'd briefly look at the following technologies: this is a React JS app built with Vite written in Typescript. Styling uses Tailwind and the graphics are SVGs that also use some MathJax output.

I also need to set up the wasm bindings for both ends.

Running:

```
cd ui
npm install
npm run dev
```

# Before you push

Please work on a branch when implementing new features.

```
git checkout -b branch_name
```

Please clean up your code before you push your commits. Run these before you push:

```
cargo fmt
cargo fix --allow-dirty
```


# How to git

In case you haven't used git, to fetch data from github:

```
git pull
```

to make a branch (do this before making changes):

```
git checkout -b descriptive_branch_name
```

to checkpoint changes / save a version:
```
git add -A
git commit -m "a name describing what you did"
```

to sync your changes to github so everyone else can see them:
```
git push # you might have to publish your branch but git will tell you exactly what to put.
```
