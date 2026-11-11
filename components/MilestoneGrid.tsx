
"use client";

import { useMemo } from "react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

ModuleRegistry.registerModules([AllCommunityModule]);

export type MilestoneRow = {
  id: string;
  sequence: number;
  title: string;
  amount: number;
  status: string;
  evidenceStatus: string;
  capturedAmount: number;
};

const gridTheme = themeQuartz.withParams({
  backgroundColor: "#17192e",
  foregroundColor: "#eeecff",
  headerBackgroundColor: "#20213a",
  headerTextColor: "#a9a4c7",
  oddRowBackgroundColor: "#1a1c32",
  borderColor: "rgba(180, 169, 255, 0.12)",
  rowHoverColor: "rgba(167, 139, 250, 0.09)",
  accentColor: "#a78bfa",
  fontFamily: "var(--font-geist-sans)",
  fontSize: 13,
  spacing: 8,
});

export default function MilestoneGrid({
  milestones,
}: {
  milestones: MilestoneRow[];
}) {
  const columnDefs = useMemo<ColDef<MilestoneRow>[]>(
    () => [
      {
        field: "sequence",
        headerName: "#",
        width: 75,
        maxWidth: 85,
        valueFormatter: (params) => `0${params.value}`,
      },
      {
        field: "title",
        headerName: "MILESTONE",
        flex: 2,
        minWidth: 190,
        cellStyle: {
          fontWeight: "600",
          color: "#f0edff",
        },
      },
      {
        field: "amount",
        headerName: "AGREED",
        width: 125,
        valueFormatter: (params) =>
          `$${(Number(params.value) / 100).toFixed(2)}`,
      },
      {
        field: "status",
        headerName: "STATUS",
        flex: 1,
        minWidth: 135,
        cellRenderer: (params: { value: string }) => {
          const value = params.value || "PENDING";
          const normalized = value.toUpperCase();

          const color =
            normalized === "COMPLETED" || normalized === "PAID"
              ? "#6ee7c0"
              : normalized === "NEEDS_RECOVERY" ||
                  normalized === "FAILED"
                ? "#fda4af"
                : "#fcd477";

          return (
            <span
              style={{
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${color}35`,
  background: `${color}12`,
  color,
  borderRadius: 999,
  padding: "3px 7px",
  fontSize: 10,
  lineHeight: 1.2,
  fontWeight: 600,
  whiteSpace: "nowrap",
  maxWidth: "100%",
  boxSizing: "border-box",
}}
            >
              {value.replaceAll("_", " ")}
            </span>
          );
        },
      },
      {
  field: "evidenceStatus",
  headerName: "EVIDENCE",
  flex: 1,
  minWidth: 145,
  cellRenderer: (params: { value: string }) => {
    const value = params.value || "NOT_SUBMITTED";

    const color =
      value === "PASS"
        ? "#6ee7c0"
        : value === "FAIL"
          ? "#fda4af"
          : value === "HUMAN_REVIEW"
            ? "#fcd477"
            : "#a9a4c7";

    const label =
      value === "NOT_SUBMITTED"
        ? "Not submitted"
        : value.replaceAll("_", " ");

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${color}35`,
          background: `${color}12`,
          color,
          borderRadius: 999,
          padding: "3px 7px",
          fontSize: 10,
          lineHeight: 1.2,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    );
  },
},
      {
        field: "capturedAmount",
        headerName: "CAPTURED",
        width: 125,
        valueFormatter: (params) =>
          `$${(Number(params.value) / 100).toFixed(2)}`,
      },
    ],
    []
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      filter: true,
    }),
    []
  );

  return (
    <div className="w-full overflow-hidden rounded-xl">
      <AgGridReact<MilestoneRow>
        theme={gridTheme}
        rowData={milestones}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        domLayout="autoHeight"
        suppressCellFocus={true}
        getRowId={(params) => params.data.id}
      />
    </div>
  );
}
