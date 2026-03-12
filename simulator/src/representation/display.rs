use std::fmt::{Display, Formatter, Result};

use ndarray::IxDyn;

use crate::representation::{density::Density, vector::Vector};

impl Display for Vector {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        let n = self.data.ndim();
        let dim = 1 << n;

        writeln!(f, "State vector ({} qubits):", n)?;

        for i in 0..dim {
            let mut idx = vec![0; n];

            for q in 0..n {
                idx[n - q - 1] = (i >> q) & 1;
            }

            let amp = self.data[IxDyn(&idx)];
            writeln!(f, "|{:0width$b}> : {}", i, amp, width = n)?;
        }

        Ok(())
    }
}

impl Display for Density {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        let n = self.data.ndim() / 2;
        let dim = 1 << n;

        writeln!(f, "Density matrix ({} qubits):", n)?;

        for r in 0..dim {
            for c in 0..dim {
                let mut idx = vec![0; 2 * n];

                for q in 0..n {
                    idx[n - q - 1] = (r >> q) & 1;
                    idx[n - q - 1 + n] = (c >> q) & 1;
                }

                let val = self.data[IxDyn(&idx)];
                write!(f, "{:>12} ", val)?;
            }
            writeln!(f)?;
        }

        Ok(())
    }
}
