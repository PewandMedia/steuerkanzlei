export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      belegeingaenge: {
        Row: {
          buchhaltung_id: string
          datum: string
          erstellt_am: string
          erstellt_von: string | null
          id: string
          notiz: string | null
        }
        Insert: {
          buchhaltung_id: string
          datum: string
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          notiz?: string | null
        }
        Update: {
          buchhaltung_id?: string
          datum?: string
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          notiz?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "belegeingaenge_buchhaltung_id_fkey"
            columns: ["buchhaltung_id"]
            isOneToOne: false
            referencedRelation: "buchhaltungen"
            referencedColumns: ["id"]
          },
        ]
      }
      benachrichtigungen: {
        Row: {
          buchhaltung_id: string | null
          empfaenger_id: string
          erstellt_am: string
          gelesen: boolean
          id: string
          nachricht: string
          titel: string
          typ: string
        }
        Insert: {
          buchhaltung_id?: string | null
          empfaenger_id: string
          erstellt_am?: string
          gelesen?: boolean
          id?: string
          nachricht: string
          titel: string
          typ: string
        }
        Update: {
          buchhaltung_id?: string | null
          empfaenger_id?: string
          erstellt_am?: string
          gelesen?: boolean
          id?: string
          nachricht?: string
          titel?: string
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "benachrichtigungen_buchhaltung_id_fkey"
            columns: ["buchhaltung_id"]
            isOneToOne: false
            referencedRelation: "buchhaltungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benachrichtigungen_empfaenger_id_fkey"
            columns: ["empfaenger_id"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
        ]
      }
      benutzer: {
        Row: {
          email: string
          erstellt_am: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          email: string
          erstellt_am?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          email?: string
          erstellt_am?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      buchhaltung_co_bearbeiter: {
        Row: {
          bearbeiter_id: string
          buchhaltung_id: string
          id: string
          zugewiesen_am: string
          zugewiesen_von: string | null
        }
        Insert: {
          bearbeiter_id: string
          buchhaltung_id: string
          id?: string
          zugewiesen_am?: string
          zugewiesen_von?: string | null
        }
        Update: {
          bearbeiter_id?: string
          buchhaltung_id?: string
          id?: string
          zugewiesen_am?: string
          zugewiesen_von?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buchhaltung_co_bearbeiter_bearbeiter_id_fkey"
            columns: ["bearbeiter_id"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buchhaltung_co_bearbeiter_buchhaltung_id_fkey"
            columns: ["buchhaltung_id"]
            isOneToOne: false
            referencedRelation: "buchhaltungen"
            referencedColumns: ["id"]
          },
        ]
      }
      buchhaltung_dokumente: {
        Row: {
          buchhaltung_id: string
          dateiname: string
          dateipfad: string
          erstellt_am: string
          hochgeladen_von: string
          id: string
          ocr_am: string | null
          ocr_data: Json | null
          ocr_status: string | null
        }
        Insert: {
          buchhaltung_id: string
          dateiname: string
          dateipfad: string
          erstellt_am?: string
          hochgeladen_von: string
          id?: string
          ocr_am?: string | null
          ocr_data?: Json | null
          ocr_status?: string | null
        }
        Update: {
          buchhaltung_id?: string
          dateiname?: string
          dateipfad?: string
          erstellt_am?: string
          hochgeladen_von?: string
          id?: string
          ocr_am?: string | null
          ocr_data?: Json | null
          ocr_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buchhaltung_dokumente_buchhaltung_id_fkey"
            columns: ["buchhaltung_id"]
            isOneToOne: false
            referencedRelation: "buchhaltungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buchhaltung_dokumente_hochgeladen_von_fkey"
            columns: ["hochgeladen_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
        ]
      }
      buchhaltungen: {
        Row: {
          abgabe_datum: string | null
          automatisierung_aktiv: boolean
          bearbeiter_id: string
          belegeingang_datum: string | null
          dauerfristverlaengerung: boolean
          erstellt_am: string
          faellig_am: string | null
          faellig_am_manuell: boolean
          fertiggestellt_datum: string | null
          gruppen_id: string | null
          id: string
          mandant_id: string
          monat: string
          notizen: string | null
          status: Database["public"]["Enums"]["buchhaltung_status"]
          zurueckgewiesen_am: string | null
        }
        Insert: {
          abgabe_datum?: string | null
          automatisierung_aktiv?: boolean
          bearbeiter_id: string
          belegeingang_datum?: string | null
          dauerfristverlaengerung?: boolean
          erstellt_am?: string
          faellig_am?: string | null
          faellig_am_manuell?: boolean
          fertiggestellt_datum?: string | null
          gruppen_id?: string | null
          id?: string
          mandant_id: string
          monat: string
          notizen?: string | null
          status?: Database["public"]["Enums"]["buchhaltung_status"]
          zurueckgewiesen_am?: string | null
        }
        Update: {
          abgabe_datum?: string | null
          automatisierung_aktiv?: boolean
          bearbeiter_id?: string
          belegeingang_datum?: string | null
          dauerfristverlaengerung?: boolean
          erstellt_am?: string
          faellig_am?: string | null
          faellig_am_manuell?: boolean
          fertiggestellt_datum?: string | null
          gruppen_id?: string | null
          id?: string
          mandant_id?: string
          monat?: string
          notizen?: string | null
          status?: Database["public"]["Enums"]["buchhaltung_status"]
          zurueckgewiesen_am?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buchhaltungen_bearbeiter_id_fkey"
            columns: ["bearbeiter_id"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buchhaltungen_mandant_id_fkey"
            columns: ["mandant_id"]
            isOneToOne: false
            referencedRelation: "mandanten"
            referencedColumns: ["id"]
          },
        ]
      }
      buchhaltungs_abschluesse: {
        Row: {
          buchhaltung_id: string
          erstellt_am: string
          erstellt_von: string
          finanzamt_eingereicht_am: string | null
          finanzamt_referenz: string | null
          freigegeben_am: string | null
          freigegeben_von: string | null
          id: string
          journal_data: Json
          journal_pdf_pfad: string | null
          paket_pdf_pfad: string | null
          steuerberater_geprueft_am: string | null
          steuerberater_geprueft_von: string | null
          steuerberater_notiz: string | null
          susa_data: Json
          susa_pdf_pfad: string | null
          ustva_kennziffern: Json
          ustva_pdf_pfad: string | null
        }
        Insert: {
          buchhaltung_id: string
          erstellt_am?: string
          erstellt_von: string
          finanzamt_eingereicht_am?: string | null
          finanzamt_referenz?: string | null
          freigegeben_am?: string | null
          freigegeben_von?: string | null
          id?: string
          journal_data?: Json
          journal_pdf_pfad?: string | null
          paket_pdf_pfad?: string | null
          steuerberater_geprueft_am?: string | null
          steuerberater_geprueft_von?: string | null
          steuerberater_notiz?: string | null
          susa_data?: Json
          susa_pdf_pfad?: string | null
          ustva_kennziffern?: Json
          ustva_pdf_pfad?: string | null
        }
        Update: {
          buchhaltung_id?: string
          erstellt_am?: string
          erstellt_von?: string
          finanzamt_eingereicht_am?: string | null
          finanzamt_referenz?: string | null
          freigegeben_am?: string | null
          freigegeben_von?: string | null
          id?: string
          journal_data?: Json
          journal_pdf_pfad?: string | null
          paket_pdf_pfad?: string | null
          steuerberater_geprueft_am?: string | null
          steuerberater_geprueft_von?: string | null
          steuerberater_notiz?: string | null
          susa_data?: Json
          susa_pdf_pfad?: string | null
          ustva_kennziffern?: Json
          ustva_pdf_pfad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buchhaltungs_abschluesse_buchhaltung_id_fkey"
            columns: ["buchhaltung_id"]
            isOneToOne: true
            referencedRelation: "buchhaltungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buchhaltungs_abschluesse_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buchhaltungs_abschluesse_freigegeben_von_fkey"
            columns: ["freigegeben_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
        ]
      }
      buchungen: {
        Row: {
          beschreibung: string
          betrag: number
          buchhaltung_id: string
          buchungsdatum: string
          dokument_id: string | null
          erstellt_am: string
          erstellt_von: string
          geaendert_am: string | null
          geaendert_von: string | null
          id: string
          kategorie: string
          konto: string
          lieferant: string | null
          mandant_id: string
          mwst_satz: number
        }
        Insert: {
          beschreibung?: string
          betrag: number
          buchhaltung_id: string
          buchungsdatum: string
          dokument_id?: string | null
          erstellt_am?: string
          erstellt_von: string
          geaendert_am?: string | null
          geaendert_von?: string | null
          id?: string
          kategorie: string
          konto: string
          lieferant?: string | null
          mandant_id: string
          mwst_satz?: number
        }
        Update: {
          beschreibung?: string
          betrag?: number
          buchhaltung_id?: string
          buchungsdatum?: string
          dokument_id?: string | null
          erstellt_am?: string
          erstellt_von?: string
          geaendert_am?: string | null
          geaendert_von?: string | null
          id?: string
          kategorie?: string
          konto?: string
          lieferant?: string | null
          mandant_id?: string
          mwst_satz?: number
        }
        Relationships: [
          {
            foreignKeyName: "buchungen_buchhaltung_id_fkey"
            columns: ["buchhaltung_id"]
            isOneToOne: false
            referencedRelation: "buchhaltungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buchungen_dokument_id_fkey"
            columns: ["dokument_id"]
            isOneToOne: false
            referencedRelation: "buchhaltung_dokumente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buchungen_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buchungen_geaendert_von_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buchungen_mandant_id_fkey"
            columns: ["mandant_id"]
            isOneToOne: false
            referencedRelation: "mandanten"
            referencedColumns: ["id"]
          },
        ]
      }
      kommentare: {
        Row: {
          buchhaltung_id: string
          erstellt_am: string
          id: string
          kommentar: string
          user_id: string
        }
        Insert: {
          buchhaltung_id: string
          erstellt_am?: string
          id?: string
          kommentar: string
          user_id: string
        }
        Update: {
          buchhaltung_id?: string
          erstellt_am?: string
          id?: string
          kommentar?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kommentare_buchhaltung_id_fkey"
            columns: ["buchhaltung_id"]
            isOneToOne: false
            referencedRelation: "buchhaltungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kommentare_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
        ]
      }
      mandanten: {
        Row: {
          dauerfristverlaengerung: boolean
          email: string | null
          erstellt_am: string
          firma: string | null
          geburtsdatum: string | null
          id: string
          mandanten_nummer: string
          nachname: string | null
          name: string
          notizen: string | null
          ort: string | null
          plz: string | null
          steuer_id: string | null
          steuernummer: string | null
          strasse: string | null
          telefon: string | null
          umsatzsteuer_id: string | null
          unternehmensform: string | null
          vorname: string | null
          zugewiesener_bearbeiter_id: string | null
        }
        Insert: {
          dauerfristverlaengerung?: boolean
          email?: string | null
          erstellt_am?: string
          firma?: string | null
          geburtsdatum?: string | null
          id?: string
          mandanten_nummer: string
          nachname?: string | null
          name: string
          notizen?: string | null
          ort?: string | null
          plz?: string | null
          steuer_id?: string | null
          steuernummer?: string | null
          strasse?: string | null
          telefon?: string | null
          umsatzsteuer_id?: string | null
          unternehmensform?: string | null
          vorname?: string | null
          zugewiesener_bearbeiter_id?: string | null
        }
        Update: {
          dauerfristverlaengerung?: boolean
          email?: string | null
          erstellt_am?: string
          firma?: string | null
          geburtsdatum?: string | null
          id?: string
          mandanten_nummer?: string
          nachname?: string | null
          name?: string
          notizen?: string | null
          ort?: string | null
          plz?: string | null
          steuer_id?: string | null
          steuernummer?: string | null
          strasse?: string | null
          telefon?: string | null
          umsatzsteuer_id?: string | null
          unternehmensform?: string | null
          vorname?: string | null
          zugewiesener_bearbeiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mandanten_zugewiesener_bearbeiter_id_fkey"
            columns: ["zugewiesener_bearbeiter_id"]
            isOneToOne: false
            referencedRelation: "benutzer"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["benutzer_rolle"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["benutzer_rolle"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["benutzer_rolle"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_benutzer_id: { Args: never; Returns: string }
      has_buchhaltung_access: {
        Args: { _buchhaltung_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["benutzer_rolle"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      benutzer_rolle: "Sekretariat" | "Sachbearbeiter" | "Chef"
      buchhaltung_status:
        | "Eingegangen"
        | "In Bearbeitung"
        | "Warten auf Mandant"
        | "In Prüfung"
        | "Buchhaltung erledigt"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      benutzer_rolle: ["Sekretariat", "Sachbearbeiter", "Chef"],
      buchhaltung_status: [
        "Eingegangen",
        "In Bearbeitung",
        "Warten auf Mandant",
        "In Prüfung",
        "Buchhaltung erledigt",
      ],
    },
  },
} as const
