# Makumbura SD Train Spike Dataset Notes

File: makumbura_sd_train_spike_dataset.csv
Sample rate: 10 Hz (100 ms per sample)
Total samples: 10000 (~1000 seconds)

## Segment labels by sample index
- 0-3332: idle noise baseline
- 3333-4999: approaching train (growing vibration)
- 5000-6221: train passing (strong spikes)
- 6222-7777: departing train (decaying vibration)
- 7778-9999: idle noise baseline

## CSV schema (XYZ for both sensors)
- sample_index,s1_x_g,s1_y_g,s1_z_g,s1_x_v,s1_y_v,s1_z_v,s2_x_g,s2_y_g,s2_z_g,s2_x_v,s2_y_v,s2_z_v

## Notes
- Y-axis is intentionally fixed to 0.0000 g (and 1.6500 V) because Y is not connected in hardware.
- X/Z include idle noise plus train-event spikes.
- Schema keeps Y columns so the file remains compatible with XYZ readers.
