<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AiModel;
use App\Models\Category;
use App\Models\DistributionChannel;
use App\Models\Prompt;
use App\Models\Task;
use App\Services\GeoFlow\ArticleCampaignWizardService;
use App\Support\AdminWeb;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Throwable;

class ArticleCampaignController extends Controller
{
    public function __construct(private readonly ArticleCampaignWizardService $campaignWizardService) {}

    public function create(Request $request): View
    {
        $distributionChannels = $this->loadDistributionChannels();
        $isCustomerRoute = $this->isCustomerRoute($request);

        return view('admin.article-campaigns.create', [
            'pageTitle' => __('admin.article_campaigns.page_title'),
            'activeMenu' => $isCustomerRoute ? 'campaigns' : 'tasks',
            'adminSiteName' => AdminWeb::siteName(),
            'layout' => $isCustomerRoute ? 'customer.layouts.app' : 'admin.layouts.app',
            'categories' => $this->loadCategories(),
            'distributionChannels' => $distributionChannels,
            'hasDistributionChannels' => count($distributionChannels) > 0,
            'canCreateCampaign' => $this->canCreateCampaign(),
            'advancedTaskUrl' => $isCustomerRoute ? null : route('admin.tasks.create'),
            'campaignBackUrl' => $isCustomerRoute ? route('customer.dashboard').'#campaigns' : route('admin.tasks.index'),
            'campaignCancelUrl' => $isCustomerRoute ? route('customer.dashboard') : route('admin.tasks.index'),
            'campaignStoreRoute' => $isCustomerRoute ? route('customer.campaigns.store') : route('admin.article-campaigns.store'),
            'campaignPreviewRoute' => $isCustomerRoute ? route('customer.campaigns.preview') : route('admin.article-campaigns.preview'),
            'isCustomerShell' => $isCustomerRoute,
        ]);
    }

    public function created(Request $request, int $taskId): View
    {
        $isCustomerRoute = $this->isCustomerRoute($request);
        $task = Task::query()
            ->with(['titleLibrary', 'knowledgeBase', 'distributionChannels'])
            ->findOrFail($taskId);

        $brief = [];
        if (is_string($task->geo_brief_json) && trim($task->geo_brief_json) !== '') {
            $decoded = json_decode($task->geo_brief_json, true);
            $brief = is_array($decoded) ? $decoded : [];
        }

        return view('admin.article-campaigns.created', [
            'pageTitle' => __('admin.article_campaigns.created.page_title'),
            'activeMenu' => $isCustomerRoute ? 'campaigns' : 'tasks',
            'adminSiteName' => AdminWeb::siteName(),
            'layout' => $isCustomerRoute ? 'customer.layouts.app' : 'admin.layouts.app',
            'task' => $task,
            'brief' => $brief,
            'createAnotherUrl' => $isCustomerRoute ? route('customer.campaigns.create') : route('admin.article-campaigns.create'),
            'dashboardUrl' => $isCustomerRoute ? route('customer.dashboard') : route('admin.tasks.index'),
            'articlesUrl' => route('admin.articles.index', ['task_id' => (int) $task->id]),
            'isCustomerShell' => $isCustomerRoute,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (! $this->canCreateCampaign()) {
            return back()
                ->withInput()
                ->withErrors(__('admin.article_campaigns.error.missing_defaults'));
        }

        $payload = $request->validate([
            'brand_name' => ['required', 'string', 'max:160'],
            'brand_url' => ['required', 'string', 'max:500'],
            'business_summary' => ['nullable', 'string', 'max:500'],
            'competitors' => ['nullable', 'string', 'max:1200'],
            'target_prompts' => ['nullable', 'string', 'max:1600'],
            'objective' => ['required', 'string', 'in:ai_recommendation,competitor_comparison,source_gap,comparison_page'],
            'article_count' => ['required', 'integer', 'min:1', 'max:50'],
            'need_review' => ['nullable'],
            'publish_scope' => ['required', 'string', 'in:local_and_distribution,distribution_only,local_only'],
            'publish_interval' => ['nullable', 'integer', 'min:1', 'max:10080'],
            'fixed_category_id' => ['nullable', 'integer', 'min:1'],
            'distribution_channel_ids' => ['nullable', 'array'],
            'distribution_channel_ids.*' => ['integer', 'min:1'],
        ]);

        if (! DistributionChannel::query()->where('status', 'active')->exists()) {
            $payload['publish_scope'] = 'local_only';
            $payload['distribution_channel_ids'] = [];
        }

        try {
            $result = $this->campaignWizardService->createCampaign($payload);
        } catch (Throwable $e) {
            return back()
                ->withInput()
                ->withErrors(__('admin.article_campaigns.error.create_failed', ['message' => $e->getMessage()]));
        }

        $createdRoute = $request->routeIs('customer.*') ? 'customer.campaigns.created' : 'admin.article-campaigns.created';

        return redirect()
            ->route($createdRoute, ['taskId' => (int) $result['task']->id])
            ->with('message', __('admin.article_campaigns.message.created'));
    }

    public function preview(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'brand_name' => ['nullable', 'string', 'max:160'],
            'brand_url' => ['required', 'string', 'max:500'],
            'business_summary' => ['nullable', 'string', 'max:500'],
            'competitors' => ['nullable', 'string', 'max:1200'],
            'target_prompts' => ['nullable', 'string', 'max:1600'],
            'objective' => ['required', 'string', 'in:ai_recommendation,competitor_comparison,source_gap,comparison_page'],
            'article_count' => ['required', 'integer', 'min:1', 'max:50'],
        ]);

        try {
            return response()->json([
                'ok' => true,
                'preview' => $this->campaignWizardService->previewCampaign($payload),
            ]);
        } catch (Throwable $e) {
            return response()->json([
                'ok' => false,
                'message' => __('admin.article_campaigns.error.preview_failed', ['message' => $e->getMessage()]),
            ], 422);
        }
    }

    /**
     * @return list<array{id:int,name:string}>
     */
    private function loadCategories(): array
    {
        return Category::query()
            ->select(['id', 'name'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(static fn (Category $row): array => ['id' => (int) $row->id, 'name' => (string) $row->name])
            ->all();
    }

    /**
     * @return list<array{id:int,name:string,domain:string}>
     */
    private function loadDistributionChannels(): array
    {
        return DistributionChannel::query()
            ->select(['id', 'name', 'domain'])
            ->where('status', 'active')
            ->orderBy('name')
            ->get()
            ->map(static fn (DistributionChannel $row): array => [
                'id' => (int) $row->id,
                'name' => (string) $row->name,
                'domain' => (string) $row->domain,
            ])
            ->all();
    }

    private function canCreateCampaign(): bool
    {
        $hasPrompt = Prompt::query()->where('type', 'content')->exists();
        $hasModel = AiModel::query()
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('model_type')
                    ->orWhere('model_type', '')
                    ->orWhere('model_type', 'chat');
            })
            ->exists();

        return $hasPrompt && $hasModel;
    }

    private function isCustomerRoute(Request $request): bool
    {
        return $request->routeIs('customer.*');
    }
}
