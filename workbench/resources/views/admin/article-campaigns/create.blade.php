@extends($layout ?? 'admin.layouts.app')

@php
    $t = static fn (string $key, array $replace = []): string => __("admin.article_campaigns.$key", $replace);
    $publishScope = (string) old('publish_scope', 'local_only');
    $selectedDistributionChannelIds = collect(old('distribution_channel_ids', []))
        ->map(static fn ($id): string => (string) $id)
        ->all();
    $hasDistributionChannels = (bool) ($hasDistributionChannels ?? false);
    $isCustomerShell = (bool) ($isCustomerShell ?? false);
    $campaignBackUrl = (string) ($campaignBackUrl ?? route('admin.tasks.index'));
    $campaignCancelUrl = (string) ($campaignCancelUrl ?? route('admin.tasks.index'));
    $campaignStoreRoute = (string) ($campaignStoreRoute ?? route('admin.article-campaigns.store'));
    $campaignPreviewRoute = (string) ($campaignPreviewRoute ?? route('admin.article-campaigns.preview'));
    $cardClass = $isCustomerShell
        ? 'rounded-lg border border-[#d8dfd9] bg-white shadow-sm'
        : 'rounded-lg border border-gray-200 bg-white shadow-sm';
    $primaryButtonClass = $isCustomerShell
        ? 'inline-flex items-center justify-center rounded-md border border-transparent bg-[#17201b] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#2f3b34] disabled:cursor-not-allowed disabled:opacity-50'
        : 'inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
@endphp

@section('content')
    <div class="px-4 sm:px-0">
        <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div class="min-w-0">
                @if($isCustomerShell)
                    <p class="mb-3 text-xs font-semibold tracking-normal text-[#0f766e]">内容计划工作台</p>
                @endif
                <div class="flex items-center gap-3">
                    <a href="{{ $campaignBackUrl }}" class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50" title="{{ __('admin.common.back') }}">
                        <i data-lucide="arrow-left" class="h-4 w-4"></i>
                    </a>
                    <div>
                        <h1 class="text-2xl font-bold {{ $isCustomerShell ? 'text-[#17201b]' : 'text-gray-950' }}">{{ $t('page_heading') }}</h1>
                        <p class="mt-1 text-sm {{ $isCustomerShell ? 'text-[#64716a]' : 'text-gray-600' }}">{{ $t('page_subtitle') }}</p>
                    </div>
                </div>
            </div>
        </div>

        @unless($canCreateCampaign)
            <div class="mb-6 rounded-md border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <div class="font-semibold">{{ $t('missing_defaults_title') }}</div>
                <div class="mt-1">{{ $t('missing_defaults_desc') }}</div>
            </div>
        @endunless

        <form method="POST" action="{{ $campaignStoreRoute }}" class="space-y-6" data-campaign-wizard-form>
            @csrf

            <div class="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <section class="{{ $cardClass }} xl:col-span-8">
                    <div class="border-b border-gray-200 px-6 py-4">
                        <div class="flex items-center gap-3">
                            <span class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 text-blue-700"><i data-lucide="building-2" class="h-4 w-4"></i></span>
                            <div>
                                <h2 class="text-base font-semibold text-gray-950">{{ $t('section.brand_title') }}</h2>
                                <p class="mt-0.5 text-sm text-gray-600">{{ $t('section.brand_desc') }}</p>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 gap-5 px-6 py-5 lg:grid-cols-2">
                        <div>
                            <label for="brand_name" class="block text-sm font-medium text-gray-800">{{ $t('field.brand_name') }} *</label>
                            <input id="brand_name" name="brand_name" required value="{{ old('brand_name') }}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="{{ $t('placeholder.brand_name') }}">
                        </div>
                        <div>
                            <label for="brand_url" class="block text-sm font-medium text-gray-800">{{ $t('field.brand_url') }} *</label>
                            <input id="brand_url" name="brand_url" required value="{{ old('brand_url') }}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="https://example.com">
                        </div>
                        <div class="lg:col-span-2">
                            <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <label for="business_summary" class="block text-sm font-medium text-gray-800">{{ $t('field.business_summary') }}</label>
                                    <p class="mt-1 text-xs text-gray-500">{{ $t('help.business_summary_auto') }}</p>
                                </div>
                                <button type="button" class="inline-flex w-fit items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100" data-preview-button>
                                    <i data-lucide="scan-search" class="mr-2 h-4 w-4"></i>
                                    {{ $t('button.preview_campaign') }}
                                </button>
                            </div>
                            <input id="business_summary" name="business_summary" maxlength="500" value="{{ old('business_summary') }}" class="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="{{ $t('placeholder.business_summary') }}">
                            <p class="mt-1 text-sm text-gray-500">{{ $t('help.business_summary') }}</p>
                        </div>
                        <div>
                            <label for="competitors" class="block text-sm font-medium text-gray-800">{{ $t('field.competitors') }}</label>
                            <textarea id="competitors" name="competitors" rows="4" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="{{ $t('placeholder.competitors') }}">{{ old('competitors') }}</textarea>
                        </div>
                        <div>
                            <label for="target_prompts" class="block text-sm font-medium text-gray-800">{{ $t('field.target_prompts') }}</label>
                            <textarea id="target_prompts" name="target_prompts" rows="4" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="{{ $t('placeholder.target_prompts') }}">{{ old('target_prompts') }}</textarea>
                        </div>
                    </div>
                </section>

                <aside class="{{ $cardClass }} xl:col-span-4">
                    <div class="border-b border-gray-200 px-6 py-4">
                        <div class="flex items-center gap-3">
                            <span class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><i data-lucide="wand-sparkles" class="h-4 w-4"></i></span>
                            <div>
                                <h2 class="text-base font-semibold text-gray-950">{{ $t('auto_title') }}</h2>
                                <p class="mt-0.5 text-sm text-gray-600">{{ $t('auto_desc') }}</p>
                            </div>
                        </div>
                    </div>
                    <div class="divide-y divide-gray-100 px-6 py-2 text-sm">
                        @foreach (['crawl', 'knowledge', 'titles', 'brief', 'task'] as $item)
                            <div class="flex items-start gap-3 py-3">
                                <i data-lucide="check-circle-2" class="mt-0.5 h-4 w-4 text-emerald-600"></i>
                                <span class="text-gray-700">{{ $t('auto.'.$item) }}</span>
                            </div>
                        @endforeach
                    </div>
                </aside>
            </div>

            <section class="{{ $cardClass }}">
                <div class="border-b border-gray-200 px-6 py-4">
                    <div class="flex items-center gap-3">
                        <span class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700"><i data-lucide="target" class="h-4 w-4"></i></span>
                        <div>
                            <h2 class="text-base font-semibold text-gray-950">{{ $t('section.plan_title') }}</h2>
                            <p class="mt-0.5 text-sm text-gray-600">{{ $t('section.plan_desc') }}</p>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-1 gap-5 px-6 py-5 lg:grid-cols-3">
                    <div>
                        <label for="objective" class="block text-sm font-medium text-gray-800">{{ $t('field.objective') }}</label>
                        <select id="objective" name="objective" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            @foreach (['ai_recommendation', 'competitor_comparison', 'source_gap', 'comparison_page'] as $objective)
                                <option value="{{ $objective }}" @selected(old('objective', 'ai_recommendation') === $objective)>{{ $t('objective.'.$objective) }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div>
                        <label for="article_count" class="block text-sm font-medium text-gray-800">{{ $t('field.article_count') }}</label>
                        <input type="number" id="article_count" name="article_count" min="1" max="50" value="{{ old('article_count', '6') }}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    </div>
                    <div>
                        <label for="fixed_category_id" class="block text-sm font-medium text-gray-800">{{ $t('field.category') }}</label>
                        <select id="fixed_category_id" name="fixed_category_id" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            <option value="">{{ $t('option.smart_category') }}</option>
                            @foreach ($categories as $category)
                                <option value="{{ $category['id'] }}" @selected((string) old('fixed_category_id') === (string) $category['id'])>{{ $category['name'] }}</option>
                            @endforeach
                        </select>
                    </div>
                    @if ($hasDistributionChannels)
                        <div>
                            <label for="publish_scope" class="block text-sm font-medium text-gray-800">{{ $t('field.publish_scope') }}</label>
                            <select id="publish_scope" name="publish_scope" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" data-publish-scope-select>
                                @foreach (['local_only', 'local_and_distribution', 'distribution_only'] as $scope)
                                    <option value="{{ $scope }}" @selected($publishScope === $scope)>{{ $t('publish_scope.'.$scope) }}</option>
                                @endforeach
                            </select>
                        </div>
                    @else
                        <div>
                            <label class="block text-sm font-medium text-gray-800">{{ $t('field.publish_scope') }}</label>
                            <input type="hidden" name="publish_scope" value="local_only">
                            <div class="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{{ $t('publish_scope.local_only') }}</div>
                            <p class="mt-1 text-sm text-gray-500">{{ $t('help.no_distribution_scope') }}</p>
                        </div>
                    @endif
                    <div>
                        <label for="publish_interval" class="block text-sm font-medium text-gray-800">{{ $t('field.publish_interval') }}</label>
                        <input type="number" id="publish_interval" name="publish_interval" min="1" value="{{ old('publish_interval', '60') }}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    </div>
                    <div class="flex items-center pt-6">
                        <input type="checkbox" id="need_review" name="need_review" value="1" @checked((bool) old('need_review', true)) class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                        <label for="need_review" class="ml-2 block text-sm font-medium text-gray-800">{{ $t('field.need_review') }}</label>
                    </div>
                    @if ($hasDistributionChannels)
                        <div class="lg:col-span-3" data-distribution-channel-section>
                            <div class="text-sm font-medium text-gray-800">{{ $t('field.distribution_channels') }}</div>
                            <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                @foreach ($distributionChannels as $channel)
                                    @php($channelId = (string) $channel['id'])
                                    <label class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 px-4 py-3 text-sm hover:border-blue-300 hover:bg-blue-50" data-distribution-channel-card>
                                        <input type="checkbox" name="distribution_channel_ids[]" value="{{ $channelId }}" @checked(in_array($channelId, $selectedDistributionChannelIds, true)) class="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" data-distribution-channel-input>
                                        <span class="min-w-0">
                                            <span class="block font-medium text-gray-900">{{ $channel['name'] }}</span>
                                            <span class="block break-all text-gray-500">{{ $channel['domain'] }}</span>
                                        </span>
                                    </label>
                                @endforeach
                            </div>
                        </div>
                    @endif
                </div>
            </section>

            <section class="hidden rounded-lg border border-blue-200 bg-blue-50 shadow-sm" data-campaign-preview>
                <div class="border-b border-blue-100 px-6 py-4">
                    <div class="flex items-center gap-3">
                        <span class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-blue-700"><i data-lucide="list-checks" class="h-4 w-4"></i></span>
                        <div>
                            <h2 class="text-base font-semibold text-blue-950">{{ $t('preview.title') }}</h2>
                            <p class="mt-0.5 text-sm text-blue-800">{{ $t('preview.desc') }}</p>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-1 gap-5 px-6 py-5 lg:grid-cols-3">
                    <div class="rounded-md bg-white p-4 ring-1 ring-blue-100">
                        <div class="text-xs font-semibold uppercase tracking-wide text-blue-600">{{ $t('preview.positioning') }}</div>
                        <div class="mt-2 text-sm leading-6 text-gray-800" data-preview-summary></div>
                    </div>
                    <div class="rounded-md bg-white p-4 ring-1 ring-blue-100">
                        <div class="text-xs font-semibold uppercase tracking-wide text-blue-600">{{ $t('preview.sources') }}</div>
                        <ul class="mt-2 space-y-2 text-sm text-gray-700" data-preview-sources></ul>
                    </div>
                    <div class="rounded-md bg-white p-4 ring-1 ring-blue-100">
                        <div class="text-xs font-semibold uppercase tracking-wide text-blue-600">{{ $t('preview.retest') }}</div>
                        <ul class="mt-2 space-y-2 text-sm text-gray-700" data-preview-retests></ul>
                    </div>
                    <div class="lg:col-span-3 rounded-md bg-white p-4 ring-1 ring-blue-100">
                        <div class="flex items-center justify-between gap-3">
                            <div class="text-xs font-semibold uppercase tracking-wide text-blue-600">{{ $t('preview.titles') }}</div>
                            <div class="text-xs font-medium text-gray-500" data-preview-count></div>
                        </div>
                        <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" data-preview-titles></div>
                    </div>
                </div>
            </section>

            <div class="hidden rounded-md border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800" data-preview-error></div>

            <div class="flex flex-col gap-4 border-t border-gray-200 pt-5 lg:flex-row lg:items-center lg:justify-between">
                @if($advancedTaskUrl)
                    <a href="{{ $advancedTaskUrl }}" class="inline-flex w-fit items-center text-sm font-medium text-gray-500 hover:text-gray-900">
                        <i data-lucide="sliders-horizontal" class="mr-2 h-4 w-4"></i>
                        {{ $t('advanced_mode') }}
                    </a>
                @else
                    <span class="text-sm font-medium text-[#64716a]">高级生产参数已由系统自动处理，客户只需要确认内容计划。</span>
                @endif
                <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <a href="{{ $campaignCancelUrl }}" class="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">{{ __('admin.button.cancel') }}</a>
                    <button type="submit" @disabled(! $canCreateCampaign) class="{{ $primaryButtonClass }}">
                        <i data-lucide="rocket" class="mr-2 h-4 w-4"></i>
                        {{ $t('button.create_campaign') }}
                    </button>
                </div>
            </div>
        </form>
    </div>
@endsection

@push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function () {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            const scopeSelect = document.querySelector('[data-publish-scope-select]');
            const channelInputs = document.querySelectorAll('[data-distribution-channel-input]');
            const previewButton = document.querySelector('[data-preview-button]');
            const previewPanel = document.querySelector('[data-campaign-preview]');
            const previewError = document.querySelector('[data-preview-error]');

            function syncDistributionState() {
                const isLocalOnly = scopeSelect && scopeSelect.value === 'local_only';
                channelInputs.forEach((input) => {
                    input.disabled = isLocalOnly;
                    if (isLocalOnly) {
                        input.checked = false;
                    }
                    const card = input.closest('[data-distribution-channel-card]');
                    if (card) {
                        card.classList.toggle('opacity-50', isLocalOnly);
                        card.classList.toggle('cursor-not-allowed', isLocalOnly);
                        card.classList.toggle('cursor-pointer', !isLocalOnly);
                    }
                });
            }

            if (scopeSelect) {
                scopeSelect.addEventListener('change', syncDistributionState);
                syncDistributionState();
            }

            function fieldValue(name) {
                const field = document.querySelector(`[name="${name}"]`);
                return field ? field.value : '';
            }

            function renderList(target, items, emptyText) {
                if (!target) {
                    return;
                }
                const cleanItems = (items || []).filter(Boolean).slice(0, 6);
                target.innerHTML = cleanItems.length
                    ? cleanItems.map((item) => `<li class="break-words">${escapeHtml(String(item))}</li>`).join('')
                    : `<li class="text-gray-500">${escapeHtml(emptyText)}</li>`;
            }

            function escapeHtml(value) {
                return value.replace(/[&<>"']/g, (char) => ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#039;',
                }[char]));
            }

            if (previewButton) {
                previewButton.addEventListener('click', async function () {
                    if (previewError) {
                        previewError.classList.add('hidden');
                        previewError.textContent = '';
                    }
                    previewButton.disabled = true;
                    previewButton.classList.add('opacity-70', 'cursor-wait');

                    try {
                        const response = await fetch(@json($campaignPreviewRoute), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                                'X-CSRF-TOKEN': @json(csrf_token()),
                            },
                            body: JSON.stringify({
                                brand_name: fieldValue('brand_name'),
                                brand_url: fieldValue('brand_url'),
                                business_summary: fieldValue('business_summary'),
                                competitors: fieldValue('competitors'),
                                target_prompts: fieldValue('target_prompts'),
                                objective: fieldValue('objective') || 'ai_recommendation',
                                article_count: fieldValue('article_count') || 6,
                            }),
                        });
                        const data = await response.json();
                        if (!response.ok || !data.ok) {
                            throw new Error(data.message || @json($t('error.preview_generic')));
                        }

                        const preview = data.preview || {};
                        const brandNameField = document.querySelector('[name="brand_name"]');
                        const summaryField = document.querySelector('[name="business_summary"]');
                        if (brandNameField && !brandNameField.value && preview.brand_name) {
                            brandNameField.value = preview.brand_name;
                        }
                        if (summaryField && preview.business_summary) {
                            summaryField.value = preview.business_summary;
                        }

                        document.querySelector('[data-preview-summary]').textContent = preview.business_summary || '';
                        document.querySelector('[data-preview-count]').textContent = `${preview.article_count || 0} ${@json($t('preview.article_unit'))}`;
                        renderList(document.querySelector('[data-preview-sources]'), (preview.pages || []).map((page) => page.url), @json($t('preview.empty_sources')));
                        renderList(document.querySelector('[data-preview-retests]'), (preview.brief || {}).retest_prompts || [], @json($t('preview.empty_retests')));

                        const titlesTarget = document.querySelector('[data-preview-titles]');
                        if (titlesTarget) {
                            titlesTarget.innerHTML = (preview.titles || []).map((row) => `
                                <div class="rounded-md border border-gray-200 bg-gray-50 p-3">
                                    <div class="text-sm font-semibold leading-6 text-gray-900">${escapeHtml(row.title || '')}</div>
                                    <div class="mt-1 text-xs text-gray-500">${escapeHtml(row.keyword || '')}</div>
                                </div>
                            `).join('');
                        }
                        if (previewPanel) {
                            previewPanel.classList.remove('hidden');
                            previewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    } catch (error) {
                        if (previewError) {
                            previewError.textContent = error.message || @json($t('error.preview_generic'));
                            previewError.classList.remove('hidden');
                        }
                    } finally {
                        previewButton.disabled = false;
                        previewButton.classList.remove('opacity-70', 'cursor-wait');
                    }
                });
            }
        });
    </script>
@endpush
