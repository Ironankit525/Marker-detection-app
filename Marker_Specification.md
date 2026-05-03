# Custom Marker Specification & Generation Logic

To ensure highly robust and instantaneous detection, the computer vision engine is programmed to expect a strict set of geometric rules for any valid custom marker. 

## 1. Generation Logic & Measurements

All custom markers (whether Type 1 or Type 2) must adhere to the following geometric ratios. These are defined mathematically based on the total width/height of the printed marker square ($W$):

1. **Outer Shape**: The marker must be a square ($W \times W$).
2. **Solid Border Thickness**: The black border around the marker must occupy exactly **5% of the total width** ($0.05 \times W$).
3. **Anchor Dot Location (Type 1)**: To indicate orientation, a square "anchor dot" must be placed in exactly one corner.
4. **Anchor Dot Inset**: The anchor dot must start exactly **18% inward** from the absolute corner of the marker ($0.18 \times W$).
5. **Anchor Dot Size**: The anchor dot must be a solid black square with a width/height equal to **15% of the total marker width** ($0.15 \times W$).
6. **Negative Space Requirement**: To prevent false positives, at least two of the other three corners must be completely empty (less than 8% ink coverage).

## 2. Test Images in Different Orientations

Below is the digitally generated master template for the Type 1 Custom Marker, rendered in all four 90-degree rotational orientations. 

*No matter which of these orientations the camera captures, the algorithm mathematically calculates the `targetQuad` delta and forcefully rotates the image matrix to bring the anchor dot perfectly into the **Top-Left** (0° rotation) canonical position.*

### Canonical Upright (0° Rotation)
The canonical upright orientation places the anchor dot exactly in the **Top-Left** quadrant.
<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='200' height='200'><rect x='0' y='0' width='100' height='100' fill='white' stroke='black' stroke-width='10'/><rect x='18' y='18' width='15' height='15' fill='black'/><circle cx='50' cy='55' r='15' fill='none' stroke='black' stroke-width='4'/><circle cx='45' cy='52' r='2' fill='black'/><circle cx='55' cy='52' r='2' fill='black'/><path d='M 45 60 Q 50 65 55 60' fill='none' stroke='black' stroke-width='3'/></svg>"/>

### 90° Clockwise Rotation
The anchor dot shifts to the **Top-Right**. The engine detects this and rotates the matrix 90° counter-clockwise.
<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='200' height='200'><g transform='rotate(90 50 50)'><rect x='0' y='0' width='100' height='100' fill='white' stroke='black' stroke-width='10'/><rect x='18' y='18' width='15' height='15' fill='black'/><circle cx='50' cy='55' r='15' fill='none' stroke='black' stroke-width='4'/><circle cx='45' cy='52' r='2' fill='black'/><circle cx='55' cy='52' r='2' fill='black'/><path d='M 45 60 Q 50 65 55 60' fill='none' stroke='black' stroke-width='3'/></g></svg>"/>

### 180° Rotation (Upside Down)
The anchor dot shifts to the **Bottom-Right**. The engine detects this and rotates the matrix 180°.
<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='200' height='200'><g transform='rotate(180 50 50)'><rect x='0' y='0' width='100' height='100' fill='white' stroke='black' stroke-width='10'/><rect x='18' y='18' width='15' height='15' fill='black'/><circle cx='50' cy='55' r='15' fill='none' stroke='black' stroke-width='4'/><circle cx='45' cy='52' r='2' fill='black'/><circle cx='55' cy='52' r='2' fill='black'/><path d='M 45 60 Q 50 65 55 60' fill='none' stroke='black' stroke-width='3'/></g></svg>"/>

### 270° Clockwise Rotation
The anchor dot shifts to the **Bottom-Left**. The engine detects this and rotates the matrix 90° clockwise.
<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' width='200' height='200'><g transform='rotate(270 50 50)'><rect x='0' y='0' width='100' height='100' fill='white' stroke='black' stroke-width='10'/><rect x='18' y='18' width='15' height='15' fill='black'/><circle cx='50' cy='55' r='15' fill='none' stroke='black' stroke-width='4'/><circle cx='45' cy='52' r='2' fill='black'/><circle cx='55' cy='52' r='2' fill='black'/><path d='M 45 60 Q 50 65 55 60' fill='none' stroke='black' stroke-width='3'/></g></svg>"/>

