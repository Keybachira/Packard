use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};

/// Seconds of audio to keep in the ring buffer.
const BUFFER_SECONDS: usize = 12;

/// A simple ring buffer for mono f32 samples.
#[derive(Debug)]
pub struct RingBuffer {
    buffer: Vec<f32>,
    capacity: usize,
    pos: usize, // next write position
    len: usize, // number of valid entries (0..capacity)
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: vec![0.0; capacity],
            capacity,
            pos: 0,
            len: 0,
        }
    }

    /// Push a sample, advancing the position.
    pub fn push(&mut self, sample: f32) {
        self.buffer[self.pos] = sample;
        self.pos = (self.pos + 1) % self.capacity;
        if self.len < self.capacity {
            self.len += 1;
        }
    }

    /// Return a clone of the buffer in chronological order (oldest to newest).
    pub fn snapshot(&self) -> Vec<f32> {
        if self.len == 0 {
            return vec![];
        }
        let mut result = Vec::with_capacity(self.len);
        if self.len < self.capacity {
            // buffer not full yet: valid data is [0..self.len)
            result.extend_from_slice(&self.buffer[0..self.len]);
        } else {
            // buffer full: data is [self.pos..capacity) then [0..self.pos)
            result.extend_from_slice(&self.buffer[self.pos..self.capacity]);
            result.extend_from_slice(&self.buffer[0..self.pos]);
        }
        result
    }
}

/// Start capturing audio from the default input device.
///
/// Returns a handle to stop the stream and a shared ring buffer.
pub fn start_capture(sample_rate: u32) -> Result<(cpal::Stream, Arc<Mutex<RingBuffer>>), String> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| "No input device available".to_string())?;
    let config = cpal::StreamConfig {
        channels: 1,
        sample_rate,
        buffer_size: cpal::BufferSize::Default,
    };

    let ring = Arc::new(Mutex::new(RingBuffer::new(
        (sample_rate as usize) * BUFFER_SECONDS,
    )));
    let ring_clone = ring.clone();

    let err_fn = move |err| {
        eprintln!("An error occurred on stream: {}", err);
    };

    let stream = device
        .build_input_stream(
            &config,
            move |data: &[f32], _: &cpal::InputCallbackInfo| {
                let mut ring = ring_clone.lock().unwrap();
                for &sample in data {
                    ring.push(sample);
                }
            },
            err_fn,
            None,
        )
        .map_err(|e| format!("Failed to build input stream: {}", e))?;

    stream.play().map_err(|e| format!("Failed to start stream: {}", e))?;
    Ok((stream, ring))
}