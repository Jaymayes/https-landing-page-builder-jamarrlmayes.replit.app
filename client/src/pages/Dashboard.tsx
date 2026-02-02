import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Target,
  Calendar,
  DollarSign,
  TrendingUp,
  Building2,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface FunnelMetrics {
  totalVolume: number;
  highIntentCount: number;
  scheduledCount: number;
  budgetConfirmedCount: number;
  conversionRate: number;
  pipelineGenerated: number;
  // Success Fee metrics (Cash Engine)
  totalSuccessFees: number;
  collectedFees: number;
  pendingFees: number;
  bySize: Record<string, number>;
  byType: Record<string, number>;
}

interface LeadSegment {
  companySize: string;
  totalLeads: number;
  highIntentCount: number;
  scheduledCount: number;
  budgetConfirmedPercent: number;
  topPainPoints: string[];
}

interface RecentLead {
  id: number;
  name: string;
  company: string;
  painPoint: string;
  companySize: string;
  isHighIntent: boolean;
  scheduledCall: boolean;
  createdAt: string;
}

// KPI Tile Component
function KPITile({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3 text-green-500" />
            <span className="text-xs text-green-500">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Lead Status Badge
function LeadStatusBadge({ lead }: { lead: RecentLead }) {
  if (lead.scheduledCall) {
    return (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Booked
      </Badge>
    );
  }
  if (lead.isHighIntent) {
    return (
      <Badge variant="destructive">
        <Target className="h-3 w-3 mr-1" />
        High Intent
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Clock className="h-3 w-3 mr-1" />
      New
    </Badge>
  );
}

export function Dashboard() {
  // Fetch dashboard metrics
  const { data: metricsData, isLoading: metricsLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/metrics?days=30");
      if (!res.ok) throw new Error("Failed to fetch metrics");
      return res.json() as Promise<{ period: any; metrics: FunnelMetrics }>;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch lead segments
  const { data: segmentsData, isLoading: segmentsLoading } = useQuery({
    queryKey: ["dashboard-segments"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/segments?days=30");
      if (!res.ok) throw new Error("Failed to fetch segments");
      return res.json() as Promise<{ segments: LeadSegment[] }>;
    },
    refetchInterval: 60000,
  });

  // Fetch recent leads
  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/recent?limit=10");
      if (!res.ok) throw new Error("Failed to fetch recent leads");
      return res.json() as Promise<{ leads: RecentLead[] }>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const metrics = metricsData?.metrics;
  const segments = segmentsData?.segments || [];
  const recentLeads = recentData?.leads || [];

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Digital Workforce Dashboard</h1>
            <p className="text-muted-foreground">
              ROI Evidence for Business Upgrades (Last 30 Days)
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            Live Data
          </Badge>
        </div>

        {/* North Star KPI Tiles */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPITile
            title="Digital Workforce Output"
            value={metrics?.totalVolume || 0}
            subtitle="Leads handled by AI"
            icon={Users}
            loading={metricsLoading}
          />
          <KPITile
            title="High Intent Rate"
            value={
              metrics?.totalVolume
                ? `${Math.round((metrics.highIntentCount / metrics.totalVolume) * 100)}%`
                : "0%"
            }
            subtitle={`${metrics?.highIntentCount || 0} qualified leads`}
            icon={Target}
            loading={metricsLoading}
          />
          <KPITile
            title="Conversion Efficiency"
            value={`${metrics?.conversionRate || 0}%`}
            subtitle={`${metrics?.scheduledCount || 0} meetings booked`}
            icon={Calendar}
            loading={metricsLoading}
          />
          <KPITile
            title="Pipeline Generated"
            value={formatCurrency(metrics?.pipelineGenerated || 0)}
            subtitle="Based on $25k avg setup"
            icon={DollarSign}
            loading={metricsLoading}
          />
        </div>

        {/* Segmentation Table & Activity Feed */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Segmentation by Company Size */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Lead Segmentation
              </CardTitle>
              <CardDescription>
                Breakdown by company size (Target: 51-200+)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {segmentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {segments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No leads yet. Start conversations to see data.
                    </p>
                  ) : (
                    segments.map((seg) => (
                      <div
                        key={seg.companySize}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <div className="font-medium">
                            {seg.companySize || "Unknown"} employees
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {seg.topPainPoints.slice(0, 2).join(", ") || "No pain points"}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{seg.totalLeads}</div>
                          <div className="text-xs text-muted-foreground">
                            {seg.scheduledCount} booked • {seg.budgetConfirmedPercent}% budget aware
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest leads and conversions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {recentLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No leads yet. Start conversations to see activity.
                    </p>
                  ) : (
                    recentLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-start justify-between p-3 rounded-lg border"
                      >
                        <div className="space-y-1">
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {lead.company} • {lead.companySize || "Unknown"} employees
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {lead.painPoint}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <LeadStatusBadge lead={lead} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Success Fees & Lead Type Distribution */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Success Fee Tracking (Cash Engine) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Success Fees
              </CardTitle>
              <CardDescription>
                $100 per booked high-intent call
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Earned</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formatCurrency((metrics?.totalSuccessFees || 0) / 100)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Collected</span>
                  <span className="text-lg font-semibold">
                    {formatCurrency((metrics?.collectedFees || 0) / 100)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pending</span>
                  <span className="text-lg font-semibold text-amber-600">
                    {formatCurrency((metrics?.pendingFees || 0) / 100)}
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    Based on {metrics?.scheduledCount || 0} booked calls × $100/call
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lead Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Type Distribution</CardTitle>
              <CardDescription>
                Business Upgrades vs Venture Studio leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-8">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-blue-500" />
                  <div>
                    <div className="font-medium">Business Upgrades</div>
                    <div className="text-2xl font-bold">
                      {metrics?.byType?.business_upgrade || 0}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded bg-purple-500" />
                  <div>
                    <div className="font-medium">Venture Studio</div>
                    <div className="text-2xl font-bold">
                      {metrics?.byType?.venture_studio || 0}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
