@extends($layout ?? 'admin.layouts.app')

@php
    $t = static fn (string $key, array $replace = []): string => __("admin.article_campaigns.created.$key", $replace);
    $titleCount = (int) optional($task->titleLibrary)->title_count;
    $knowledgeCharacters = (int) optional($task->knowledgeBase)->character_count;
    $requiredSources = collect($brief['required_sources'] ?? [])->filter()->take(6)->values();
    $retestPrompts = collect($brief['retest_prompts'] ?? [])->filter()->take(6)->values();
    $isCustomerShell = (bool) ($isCustomerShell ?? false);
    $createAnotherUrl = (string) ($createAnotherUrl ?? route('admin.article-campaigns.create'));
    $dashboardUrl = (string) ($dashboardUrl ?? route('admin.tasks.index'));
    $articlesUrl = (string) ($articlesUrl ?? route('admin.articles.index', ['task_id' => (int) $task->id]));
    $cardClass = $isCustomerShell
        ? 'rounded-lg border border-[#d8dfd9] bg-white shadow-sm'
        : 'rounded-lg border border-gray-200 bg-white shadow-sm';
@endphp

@section('content')
    <div class="px-4 sm:px-0">
        <div class="mb-6 rounded-lg border {{ $isCustomerShell ? 'border-[#c7d0c8] bg-[#e8f5f1]' : 'border-emerald-200 bg-emerald-50' }} px-6 py-5">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="flex items-start gap-4">
                    <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md {{ $isCustomerShell ? 'bg-[#17201b]' : 'bg-emerald-600' }} text-white">
                        <i data-lucide="check-circle-2" class="h-5 w-5"></i>
                    </span>
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.18em] {{ $isCustomerShell ? 'text-[#0f766e]' : 'text-emerald-700' }}">{{ $t('eyebrow') }}</p>
                        <h1 class="mt-1 text-2xl font-bold {{ $isCustomerShell ? 'text-[#17201b]' : 'text-gray-950' }}">{{ $t('heading') }}</h1>
                        <p class="mt-2 max-w-3xl text-sm leading-6 {{ $isCustomerShell ? 'text-[#385642]' : 'text-emerald-900' }}">{{ $t('subtitle') }}</p>
                    </div>
                </div>
                <a href="{{ $createAnotherUrl }}" class="inline-flex h-10 items-center justify-center rounded-md border {{ $isCustomerShell ? 'border-[#d8dfd9] text-[#385642] hover:bg-white' : 'border-emerald-300 text-emerald-800 hover:bg-emerald-100' }} bg-white px-4 text-sm font-semibold">
                    <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
                    {{ $t('create_another') }}
                </a>
            </div>
        </div>

        <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section class="{{ $cardClass }}">
                <div class="border-b border-gray-200 px-6 py-4">
                    <h2 class="text-base font-semibold text-gray-950">{{ $t('summary_title') }}</h2>
                    <p class="mt-1 text-sm text-gray-600">{{ $t('summary_desc') }}</p>
                </div>
                <div class="grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-4 md:divide-x md:divide-y-0">
                    <div class="p-5">
                        <div class="text-sm font-medium text-gray-500">{{ $t('metric_titles') }}</div>
                        <div class="mt-2 text-2xl font-bold text-gray-950">{{ $titleCount }}</div>
                    </div>
                    <div class="p-5">
                        <div class="text-sm font-medium text-gray-500">{{ $t('metric_articles') }}</div>
                        <div class="mt-2 text-2xl font-bold text-gray-950">{{ (int) $task->article_limit }}</div>
                    </div>
                    <div class="p-5">
                        <div class="text-sm font-medium text-gray-500">{{ $t('metric_review') }}</div>
                        <div class="mt-2 text-2xl font-bold text-gray-950">{{ (int) $task->need_review === 1 ? $t('review_on') : $t('review_off') }}</div>
                    </div>
                    <div class="p-5">
                        <div class="text-sm font-medium text-gray-500">{{ $t('metric_status') }}</div>
                        <div class="mt-2 text-2xl font-bold text-gray-950">{{ $t('status_paused') }}</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 gap-5 p-6 lg:grid-cols-2">
                    <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div class="flex items-center gap-2 text-sm font-semibold text-gray-950">
                            <i data-lucide="library" class="h-4 w-4 text-blue-600"></i>
                            {{ $t('assets_title') }}
                        </div>
                        <dl class="mt-4 space-y-3 text-sm">
                            <div>
                                <dt class="font-medium text-gray-500">{{ $t('task_name') }}</dt>
                                <dd class="mt-1 text-gray-900">{{ $task->name }}</dd>
                            </div>
                            <div>
                                <dt class="font-medium text-gray-500">{{ $t('title_library') }}</dt>
                                <dd class="mt-1 text-gray-900">{{ optional($task->titleLibrary)->name ?? '-' }}</dd>
                            </div>
                            <div>
                                <dt class="font-medium text-gray-500">{{ $t('knowledge_base') }}</dt>
                                <dd class="mt-1 text-gray-900">{{ optional($task->knowledgeBase)->name ?? '-' }} · {{ number_format($knowledgeCharacters) }} chars</dd>
                            </div>
                        </dl>
                    </div>

                    <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div class="flex items-center gap-2 text-sm font-semibold text-gray-950">
                            <i data-lucide="target" class="h-4 w-4 text-emerald-600"></i>
                            {{ $t('strategy_title') }}
                        </div>
                        <dl class="mt-4 space-y-3 text-sm">
                            <div>
                                <dt class="font-medium text-gray-500">{{ $t('intent') }}</dt>
                                <dd class="mt-1 text-gray-900">{{ (string) ($brief['search_intent'] ?? '-') }}</dd>
                            </div>
                            <div>
                                <dt class="font-medium text-gray-500">{{ $t('target_prompt') }}</dt>
                                <dd class="mt-1 text-gray-900">{{ (string) ($brief['target_prompt'] ?? '-') }}</dd>
                            </div>
                            <div>
                                <dt class="font-medium text-gray-500">{{ $t('publish_scope') }}</dt>
                                <dd class="mt-1 text-gray-900">{{ __('admin.article_campaigns.publish_scope.'.(string) $task->publish_scope) }}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </section>

            <aside class="space-y-5">
                <div class="{{ $cardClass }} p-5">
                    <h2 class="text-base font-semibold text-gray-950">{{ $t('next_title') }}</h2>
                    <p class="mt-2 text-sm leading-6 text-gray-600">{{ $t('next_desc') }}</p>
                    <div class="mt-5 grid gap-3">
                        <form method="POST" action="{{ route('admin.tasks.toggle-status', ['taskId' => (int) $task->id]) }}">
                            @csrf
                            <button type="submit" class="inline-flex h-10 w-full items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
                                <i data-lucide="play" class="mr-2 h-4 w-4"></i>
                                {{ $t('start_generation') }}
                            </button>
                        </form>
                        @if($isCustomerShell)
                            <a href="{{ $dashboardUrl }}" class="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                                <i data-lucide="layout-dashboard" class="mr-2 h-4 w-4"></i>
                                返回增长总览
                            </a>
                            <a href="{{ $articlesUrl }}" class="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                                <i data-lucide="newspaper" class="mr-2 h-4 w-4"></i>
                                查看生成文章
                            </a>
                        @else
                            <a href="{{ route('admin.tasks.edit', ['taskId' => (int) $task->id]) }}" class="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                                <i data-lucide="settings-2" class="mr-2 h-4 w-4"></i>
                                {{ $t('edit_strategy') }}
                            </a>
                            <a href="{{ route('admin.tasks.index') }}" class="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                                <i data-lucide="list-checks" class="mr-2 h-4 w-4"></i>
                                {{ $t('view_queue') }}
                            </a>
                        @endif
                    </div>
                </div>

                <div class="{{ $cardClass }} p-5">
                    <h2 class="text-base font-semibold text-gray-950">{{ $t('evidence_title') }}</h2>
                    <div class="mt-4 space-y-4">
                        <div>
                            <div class="text-sm font-medium text-gray-500">{{ $t('sources') }}</div>
                            <div class="mt-2 space-y-2">
                                @forelse ($requiredSources as $source)
                                    <div class="truncate rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">{{ $source }}</div>
                                @empty
                                    <div class="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">{{ $t('empty_sources') }}</div>
                                @endforelse
                            </div>
                        </div>
                        <div>
                            <div class="text-sm font-medium text-gray-500">{{ $t('retest_prompts') }}</div>
                            <div class="mt-2 space-y-2">
                                @foreach ($retestPrompts as $prompt)
                                    <div class="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">{{ $prompt }}</div>
                                @endforeach
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    </div>
@endsection
