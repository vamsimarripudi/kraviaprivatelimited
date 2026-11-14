import type {ReactNode} from "react";
import {OfficeConnectPreferencesRoot} from "@/components/office-connect-preferences-root";
export default function ConnectLayout({children}:{children:ReactNode}){
 return <OfficeConnectPreferencesRoot>{children}</OfficeConnectPreferencesRoot>;
}
