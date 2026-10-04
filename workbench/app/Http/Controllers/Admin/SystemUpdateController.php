<?php

// Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE.

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\AdminUpdateSafetyGateService;
use App\Support\AdminWeb;
use Illuminate\View\View;

class SystemUpdateController extends Controller
{
    public function __construct(
        private readonly AdminUpdateSafetyGateService $updateSafetyGateService
    ) {}

    public function index(): View
    {
        return view('admin.system-updates.index', [
            'pageTitle' => __('admin.system_updates.page_title'),
            'activeMenu' => 'system_updates',
            'adminSiteName' => AdminWeb::siteName(),
            'plan' => $this->updateSafetyGateService->buildPlan(),
        ]);
    }
}
