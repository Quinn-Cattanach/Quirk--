use num_complex::Complex32;

#[derive(Copy, Clone, Debug)]
pub enum PrimitiveState {
    Zero,
    One,
    Plus,
    Minus,
    PlusI,
    MinusI,
}

impl PrimitiveState {
    pub fn repr(&self) -> [Complex32; 2] {
        let sqrt2_inv = 1.0 / 2f32.sqrt();
        match self {
            PrimitiveState::Zero => [Complex32::new(1.0, 0.0), Complex32::new(0.0, 0.0)],
            PrimitiveState::One => [Complex32::new(0.0, 0.0), Complex32::new(1.0, 0.0)],
            PrimitiveState::Plus => [
                Complex32::new(sqrt2_inv, 0.0),
                Complex32::new(sqrt2_inv, 0.0),
            ],
            PrimitiveState::Minus => [
                Complex32::new(sqrt2_inv, 0.0),
                Complex32::new(-sqrt2_inv, 0.0),
            ],
            PrimitiveState::PlusI => [
                Complex32::new(sqrt2_inv, 0.0),
                Complex32::new(0.0, sqrt2_inv),
            ],
            PrimitiveState::MinusI => [
                Complex32::new(sqrt2_inv, 0.0),
                Complex32::new(0.0, -sqrt2_inv),
            ],
        }
    }
}
