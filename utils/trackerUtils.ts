export function calculateStrideLength(heightCm: number): number {
  if (heightCm <= 0) return 0;
  return (heightCm * 0.414) / 100;
}


export function calculateDistance(steps: number, heightCm: number): number {
  if (steps <= 0 || heightCm <= 0) return 0;
  const strideMeters = calculateStrideLength(heightCm);
  const distanceKm = (steps * strideMeters) / 1000;
  return parseFloat(distanceKm.toFixed(2));
}

export function calculateCalories(
  steps: number,
  weightKg: number,
  heightCm: number,
  useAcsmFormula: boolean = true
): number {
  if (steps <= 0 || weightKg <= 0 || heightCm <= 0) return 0;

  if (useAcsmFormula) {
    const distanceKm = calculateDistance(steps, heightCm);
    const caloriesVal = 0.721 * weightKg * distanceKm;
    return parseFloat(caloriesVal.toFixed(2));
  }

  // Fallback to basic formula
  const caloriesVal = steps * 0.04 * (weightKg / 70);
  return parseFloat(caloriesVal.toFixed(2));
}
