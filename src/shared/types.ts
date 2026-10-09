/** `Omit` que preserva uniões discriminadas (o `Omit` nativo junta os membros e perde o vínculo entre campos). */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** `Pick` que preserva uniões discriminadas. */
export type DistributivePick<T, K extends keyof T> = T extends unknown ? Pick<T, K> : never;
