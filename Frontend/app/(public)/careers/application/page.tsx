import type {Metadata} from "next";
import {CareersPortal} from "@/components/careers-portal";
export const dynamic="force-dynamic";
export const metadata:Metadata={
  title:"Private applicant access | KRAVIA Careers",
  robots:{index:false,follow:false},
  referrer:"no-referrer",
};
export default function CareerApplicationPage() {
  return <main id="main-content"><CareersPortal/></main>;
}
