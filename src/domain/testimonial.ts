export const TESTIMONIAL_KINDS = ["result", "delivered"] as const;

/** `result`: print de comissão de cliente. `delivered`: perfil de conta entregue. */
export type TestimonialKind = (typeof TESTIMONIAL_KINDS)[number];

export interface TestimonialData {
  kind: TestimonialKind;
  title: string;
  subtitle: string;
  imageUrl: string;
  imageAlt: string;
  width: number;
  height: number;
  published: boolean;
}

export interface Testimonial extends TestimonialData {
  id: string;
  position: number;
}
