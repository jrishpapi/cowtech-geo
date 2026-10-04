@extends('admin.layouts.app')

@section('content')
    @php
        $snapshot = is_array($remoteSnapshot['snapshot'] ?? null) ? $remoteSnapshot['snapshot'] : [];
        $billingAuth = is_array($snapshot['billing_auth'] ?? null) ? $snapshot['billing_auth'] : [];
        $quotaBridge = is_array($billingAuth['quota_bridge'] ?? null) ? $billingAuth['quota_bridge'] : [];
        $quotas = is_array($quotaBridge['quotas'] ?? null) ? $quotaBridge['quotas'] : [];
        $addons = is_array($snapshot['addons'] ?? null) ? $snapshot['addons'] : [];
        $addonTotals = is_array($addons['totals'] ?? null) ? $addons['totals'] : [];
        $monitoring = is_array($snapshot['monitoring'] ?? null) ? $snapshot['monitoring'] : [];
        $fulfillment = is_array($monitoring['fulfillment'] ?? null) ? $monitoring['fulfillment'] : [];
        $liveGate = is_array($fulfillment['live_provider_gate'] ?? null) ? $fulfillment['live_provider_gate'] : [];
        $monthlyFulfillment = is_array($snapshot['monthly_fulfillment'] ?? null) ? $snapshot['monthly_fulfillment'] : [];
        $monthlySummary = is_array($monthlyFulfillment['summary'] ?? null) ? $monthlyFulfillment['summary'] : [];
        $monthlyItems = collect(is_array($monthlyFulfillment['items'] ?? null) ? $monthlyFulfillment['items'] : [])->take(12);
        $operatorSummary = is_array($snapshot['operator_summary'] ?? null) ? $snapshot['operator_summary'] : [];
        $blockers = collect(is_array($billingAuth['blockers'] ?? null) ? $billingAuth['blockers'] : [])
            ->merge(is_array($liveGate['blockers'] ?? null) ? $liveGate['blockers'] : [])
            ->merge(is_array($billingAuth['warnings'] ?? null) ? $billingAuth['warnings'] : [])
            ->filter()
            ->unique()
            ->values();
        $statusClass = function (string $status): string {
            return match ($status) {
                'active', 'trial', 'ready', 'connected', 'synced', 'entitled' => 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                'past_due', 'pending_first_run', 'pending_signup', 'pending_live_provider', 'partial' => 'bg-amber-50 text-amber-700 ring-amber-200',
                'canceled', 'paused', 'blocked', 'error', 'sync_failed', 'needs_operator_review' => 'bg-red-50 text-red-700 ring-red-200',
                default => 'bg-slate-100 text-slate-700 ring-slate-200',
            };
        };
        $metricValue = function (array $quota): string {
            $limit = $quota['limit'] ?? $quota['effective_limit'] ?? null;
            $used = $quota['used'] ?? $quota['usage'] ?? null;
            $remaining = $quota['remaining'] ?? null;
            if ($limit === null && $used === null && $remaining === null) {
                return '未上报';
            }
            return 'used '.(string) ($used ?? '0').' / limit '.(string) ($limit ?? '-').' / left '.(string) ($remaining ?? '-');
        };
    @endphp

    <div class="space-y-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <p class="text-sm font-medium text-blue-600">AIVGL Control Center</p>
                <h1 class="mt-1 text-2xl font-semibold text-gray-950">Entitlement / Dashboard 运维页</h1>
                <p class="mt-2 max-w-3xl text-sm leading-6 text-gray-600">按客户邮箱聚合本地付款权益、workspace、add-on 同步状态，并实时读取 AIVGL 只读 snapshot，用于排查 plan、quota、live gate、monthly fulfillment 和失败原因。</p>
            </div>
            <a href="{{ route('admin.dashboard') }}" class="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>
                返回后台
            </a>
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            @foreach ([
                ['label' => '本地权益客户', 'value' => $summary['customers'] ?? 0, 'icon' => 'users'],
                ['label' => '有效付款状态', 'value' => $summary['active'] ?? 0, 'icon' => 'badge-check'],
                ['label' => '已连接 AIVGL', 'value' => $summary['workspaces'] ?? 0, 'icon' => 'workflow'],
                ['label' => '同步错误', 'value' => $summary['sync_errors'] ?? 0, 'icon' => 'triangle-alert'],
            ] as $card)
                <div class="rounded-lg border border-gray-200 bg-white p-4">
                    <div class="flex items-center justify-between">
                        <div class="text-sm text-gray-500">{{ $card['label'] }}</div>
                        <i data-lucide="{{ $card['icon'] }}" class="h-4 w-4 text-gray-400"></i>
                    </div>
                    <div class="mt-2 text-2xl font-semibold text-gray-950">{{ $card['value'] }}</div>
                </div>
            @endforeach
        </div>

        <form method="GET" action="{{ route('admin.aivgl-ops.index') }}" class="rounded-lg border border-gray-200 bg-white p-4">
            <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
                <input type="search" name="q" value="{{ $filters['q'] ?? '' }}" placeholder="搜索 email / order / subscription" class="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <select name="plan" class="rounded-lg border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">全部 plan</option>
                    @foreach (['launch' => 'Launch', 'starter' => 'Starter', 'pro' => 'Pro', 'god' => 'God'] as $value => $label)
                        <option value="{{ $value }}" @selected(($filters['plan'] ?? '') === $value)>{{ $label }}</option>
                    @endforeach
                </select>
                <select name="status" class="rounded-lg border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">全部状态</option>
                    @foreach (['active', 'trial', 'past_due', 'paused', 'canceled'] as $value)
                        <option value="{{ $value }}" @selected(($filters['status'] ?? '') === $value)>{{ $value }}</option>
                    @endforeach
                </select>
                <button class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">
                    <i data-lucide="search" class="mr-2 h-4 w-4"></i>
                    筛选
                </button>
            </div>
        </form>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
            <section class="rounded-lg border border-gray-200 bg-white">
                <div class="border-b border-gray-200 px-4 py-3">
                    <h2 class="text-sm font-semibold text-gray-950">客户列表</h2>
                    <p class="mt-1 text-xs text-gray-500">最多显示最近 50 个本地 entitlement。</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 text-sm">
                        <thead class="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <tr>
                                <th class="px-4 py-3">客户</th>
                                <th class="px-4 py-3">Plan</th>
                                <th class="px-4 py-3">状态</th>
                                <th class="px-4 py-3">Add-on</th>
                                <th class="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                            @forelse ($customers as $customer)
                                @php
                                    $isSelected = $selectedEmail === $customer['email'];
                                    $query = array_filter([
                                        'q' => $filters['q'] ?? '',
                                        'plan' => $filters['plan'] ?? '',
                                        'status' => $filters['status'] ?? '',
                                        'email' => $customer['email'],
                                    ], fn ($value) => $value !== '');
                                @endphp
                                <tr class="{{ $isSelected ? 'bg-blue-50/70' : 'bg-white' }}">
                                    <td class="px-4 py-3">
                                        <div class="font-medium text-gray-950">{{ $customer['email'] }}</div>
                                        <div class="mt-1 max-w-[220px] truncate text-xs text-gray-500">{{ $customer['workspace']['brand_name'] ?? '未完成 first run' }}</div>
                                    </td>
                                    <td class="px-4 py-3">
                                        <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 {{ $statusClass($customer['plan_code']) }}">{{ strtoupper($customer['plan_code']) }}</span>
                                    </td>
                                    <td class="px-4 py-3">
                                        <span class="inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 {{ $statusClass($customer['billing_status']) }}">{{ $customer['billing_status'] }}</span>
                                    </td>
                                    <td class="px-4 py-3 text-xs text-gray-600">
                                        C {{ $customer['addons']['totals']['credits'] ?? 0 }} · A {{ $customer['addons']['totals']['article'] ?? 0 }} · K {{ $customer['addons']['totals']['competitor'] ?? 0 }}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        <a href="{{ route('admin.aivgl-ops.index', $query) }}" class="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">查看</a>
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-500">没有匹配客户。</td>
                                </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="space-y-4">
                <div class="rounded-lg border border-gray-200 bg-white p-4">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 class="text-lg font-semibold text-gray-950">{{ $selectedEmail !== '' ? $selectedEmail : '未选择客户' }}</h2>
                            <p class="mt-1 text-sm text-gray-500">{{ $selectedCustomer['workspace']['brand_name'] ?? '本地 workspace 未连接' }}</p>
                        </div>
                        <span class="inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ring-1 {{ $statusClass((string) ($snapshot['status'] ?? ($remoteSnapshot['status'] ?? 'unknown'))) }}">
                            AIVGL {{ $snapshot['status'] ?? ($remoteSnapshot['status'] ?? 'unknown') }}
                        </span>
                    </div>

                    @if (($remoteSnapshot['error'] ?? '') !== '')
                        <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            AIVGL snapshot 读取结果：{{ $remoteSnapshot['error'] }}
                        </div>
                    @endif

                    <div class="mt-4 grid gap-3 sm:grid-cols-3">
                        <div class="rounded-lg bg-gray-50 p-3">
                            <div class="text-xs text-gray-500">Plan</div>
                            <div class="mt-1 text-sm font-semibold text-gray-950">{{ strtoupper((string) ($snapshot['customer']['plan_code'] ?? $selectedCustomer['plan_code'] ?? '')) }}</div>
                        </div>
                        <div class="rounded-lg bg-gray-50 p-3">
                            <div class="text-xs text-gray-500">Entitlement</div>
                            <div class="mt-1 text-sm font-semibold text-gray-950">{{ $operatorSummary['entitlement_state'] ?? $billingAuth['entitlement']['state'] ?? 'unknown' }}</div>
                        </div>
                        <div class="rounded-lg bg-gray-50 p-3">
                            <div class="text-xs text-gray-500">Next Action</div>
                            <div class="mt-1 text-sm font-semibold text-gray-950">{{ $operatorSummary['next_operator_action'] ?? 'No entitlement action required.' }}</div>
                        </div>
                    </div>
                </div>

                <div class="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 class="text-sm font-semibold text-gray-950">Quota</h3>
                    <div class="mt-3 grid gap-3 md:grid-cols-2">
                        @forelse ($quotas as $key => $quota)
                            <div class="rounded-lg border border-gray-100 p-3">
                                <div class="text-xs font-medium text-gray-500">{{ $key }}</div>
                                <div class="mt-1 text-sm text-gray-900">{{ is_array($quota) ? $metricValue($quota) : (string) $quota }}</div>
                            </div>
                        @empty
                            <div class="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">AIVGL 尚未返回 quota bridge。</div>
                        @endforelse
                    </div>
                </div>

                <div class="grid gap-4 md:grid-cols-2">
                    <div class="rounded-lg border border-gray-200 bg-white p-4">
                        <h3 class="text-sm font-semibold text-gray-950">Add-on</h3>
                        <div class="mt-3 grid grid-cols-3 gap-2 text-center">
                            <div class="rounded-lg bg-gray-50 p-3"><div class="text-xs text-gray-500">Credits</div><div class="mt-1 font-semibold">{{ $addonTotals['credits'] ?? ($selectedCustomer['addons']['totals']['credits'] ?? 0) }}</div></div>
                            <div class="rounded-lg bg-gray-50 p-3"><div class="text-xs text-gray-500">Article</div><div class="mt-1 font-semibold">{{ $addonTotals['article'] ?? ($selectedCustomer['addons']['totals']['article'] ?? 0) }}</div></div>
                            <div class="rounded-lg bg-gray-50 p-3"><div class="text-xs text-gray-500">Competitor</div><div class="mt-1 font-semibold">{{ $addonTotals['competitor'] ?? ($selectedCustomer['addons']['totals']['competitor'] ?? 0) }}</div></div>
                        </div>
                    </div>

                    <div class="rounded-lg border border-gray-200 bg-white p-4">
                        <h3 class="text-sm font-semibold text-gray-950">Live Gate</h3>
                        <dl class="mt-3 space-y-2 text-sm">
                            <div class="flex justify-between gap-3"><dt class="text-gray-500">Mode</dt><dd class="font-medium text-gray-950">{{ $fulfillment['mode'] ?? 'not_configured' }}</dd></div>
                            <div class="flex justify-between gap-3"><dt class="text-gray-500">Live allowed</dt><dd class="font-medium text-gray-950">{{ !empty($liveGate['live_provider_allowed']) ? 'yes' : 'no' }}</dd></div>
                            <div class="flex justify-between gap-3"><dt class="text-gray-500">Live surfaces</dt><dd class="font-medium text-gray-950">{{ $fulfillment['live_surface_count'] ?? 0 }}</dd></div>
                        </dl>
                    </div>
                </div>

                <div class="rounded-lg border border-gray-200 bg-white p-4">
                    <div class="flex items-center justify-between gap-3">
                        <h3 class="text-sm font-semibold text-gray-950">Monthly Fulfillment</h3>
                        <span class="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{{ $operatorSummary['monthly_fulfillment_status'] ?? 'not_configured' }}</span>
                    </div>
                    <div class="mt-3 grid gap-2 sm:grid-cols-4">
                        @foreach (['scheduled_count' => 'Scheduled', 'queued_count' => 'Queued', 'completed_count' => 'Completed', 'failed_count' => 'Failed'] as $key => $label)
                            <div class="rounded-lg bg-gray-50 p-3"><div class="text-xs text-gray-500">{{ $label }}</div><div class="mt-1 font-semibold text-gray-950">{{ $monthlySummary[$key] ?? 0 }}</div></div>
                        @endforeach
                    </div>
                    @if ($monthlyItems->isNotEmpty())
                        <div class="mt-4 overflow-x-auto">
                            <table class="min-w-full divide-y divide-gray-100 text-sm">
                                <thead class="text-left text-xs font-semibold uppercase text-gray-500">
                                    <tr><th class="py-2 pr-3">Item</th><th class="py-2 pr-3">Status</th><th class="py-2 pr-3">Job</th><th class="py-2">Error</th></tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100">
                                    @foreach ($monthlyItems as $item)
                                        <tr>
                                            <td class="py-2 pr-3 text-gray-950">{{ $item['item_label'] ?? $item['item_type'] ?? 'item' }}</td>
                                            <td class="py-2 pr-3"><span class="rounded-full px-2 py-1 text-xs font-medium ring-1 {{ $statusClass((string) ($item['status'] ?? '')) }}">{{ $item['status'] ?? 'unknown' }}</span></td>
                                            <td class="py-2 pr-3 text-gray-600">
                                                {{ $item['job_type'] ?? '' }}
                                                @if(($item['status'] ?? '') === 'pending_operator')
                                                    <a href="{{ route('admin.tasks.create', ['aivgl_item' => $item['id'] ?? '', 'run_id' => $item['tracking_run_id'] ?? '']) }}" class="mt-1 block font-semibold text-blue-700 underline underline-offset-2">创建 / 接管任务</a>
                                                @endif
                                            </td>
                                            <td class="py-2 text-red-700">{{ $item['last_error'] ?? $item['error'] ?? '' }}</td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </div>
                    @endif
                </div>

                <div class="rounded-lg border border-gray-200 bg-white p-4">
                    <h3 class="text-sm font-semibold text-gray-950">失败 / 阻塞原因</h3>
                    @if ($blockers->isNotEmpty() || !empty($selectedCustomer['last_sync_error']) || !empty($selectedCustomer['workspace']['last_error']))
                        <div class="mt-3 flex flex-wrap gap-2">
                            @foreach ($blockers as $blocker)
                                <span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">{{ $blocker }}</span>
                            @endforeach
                            @if (!empty($selectedCustomer['last_sync_error']))
                                <span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">{{ $selectedCustomer['last_sync_error'] }}</span>
                            @endif
                            @if (!empty($selectedCustomer['workspace']['last_error']))
                                <span class="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">{{ $selectedCustomer['workspace']['last_error'] }}</span>
                            @endif
                        </div>
                    @else
                        <p class="mt-2 text-sm text-gray-500">暂无阻塞或失败原因。</p>
                    @endif
                </div>
            </section>
        </div>
    </div>
@endsection
