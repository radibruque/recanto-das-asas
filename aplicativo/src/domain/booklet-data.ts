import { z } from 'zod';
import { date } from './shared';

const text = z.string().max(10000).optional();
const optionalDate = z.union([date, z.literal('')]).optional();
export const bookletDataSchema = z.object({
  individualCode:text, ring:text, photoDate:optionalDate, sexReportDate:optionalDate,
  carriersSource:text, originDocument:text, clutchReference:text,
  ringingDate:optionalDate, nestExitDate:optionalDate, weaningDate:optionalDate,
  foodIndependenceDate:optionalDate,
  rearingType:z.enum(['pais','manual','mista','desconhecida']).optional(),
  currentDiet:text, managementHistory:text, medicalObservations:text,
  deliveryWeightGrams:z.number().finite().nonnegative().nullable().optional(),
  tutorName:text, tutorPhone:text, breederName:text, breederPhone:text,
  vetIdentity:text, vetEmergencyPhone:text,
  fieldOverrides:z.record(z.string().max(5000)).refine(v=>Object.keys(v).length<=100 && Object.keys(v).every(k=>k.length<=128),'Campos de caderneta inválidos.').optional(),
});
export type BirdBookletData = z.infer<typeof bookletDataSchema>;
