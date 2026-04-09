"use client";

import { useState } from "react";
import { TokenUsageChart } from "@/features/analytics/components/TokenUsageChart";
import { TokenUsageTable } from "@/features/analytics/components/TokenUsageTable";
import { ChartPeriod } from "@/features/analytics/api/analytics.api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, FlaskConical, LayoutList } from "lucide-react";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<ChartPeriod>("daily");
  const [showTests, setShowTests] = useState<boolean | undefined>(undefined); // undefined = all

  const isTestFilter =
    showTests === true ? true : showTests === false ? false : undefined;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-violet-500" />
            Analytics
          </h1>
          <p className="text-muted-foreground font-medium">
            Token consumption across all executions
          </p>
        </div>

        {/* isTest filter toggle */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          <Button
            size="sm"
            variant={showTests === undefined ? "default" : "ghost"}
            className={
              showTests === undefined
                ? "h-7 px-3 text-xs bg-violet-500 hover:bg-violet-600 text-white"
                : "h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
            }
            onClick={() => setShowTests(undefined)}
          >
            <LayoutList className="h-3 w-3 mr-1" />
            All
          </Button>
          <Button
            size="sm"
            variant={showTests === false ? "default" : "ghost"}
            className={
              showTests === false
                ? "h-7 px-3 text-xs bg-violet-500 hover:bg-violet-600 text-white"
                : "h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
            }
            onClick={() => setShowTests(false)}
          >
            Workflows only
          </Button>
          <Button
            size="sm"
            variant={showTests === true ? "default" : "ghost"}
            className={
              showTests === true
                ? "h-7 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                : "h-7 px-3 text-xs text-muted-foreground hover:text-foreground"
            }
            onClick={() => setShowTests(true)}
          >
            <FlaskConical className="h-3 w-3 mr-1" />
            Tests only
          </Button>
        </div>
      </div>

      {/* Chart */}
      <Card className="border-none shadow-2xl bg-card/60 backdrop-blur-md">
        <CardContent className="p-6">
          <TokenUsageChart
            period={period}
            onPeriodChange={setPeriod}
            isTest={isTestFilter}
          />
        </CardContent>
      </Card>

      {/* Table — inherits the same isTest filter */}
      <TokenUsageTable isTest={isTestFilter} />
    </div>
  );
}
