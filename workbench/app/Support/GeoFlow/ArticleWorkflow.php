<?php

// Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE.

namespace App\Support\GeoFlow;

use App\Models\Article;
use Illuminate\Support\Str;

final class ArticleWorkflow
{
    public static function normalizeState(string $status, string $reviewStatus, ?string $publishedAt = null): array
    {
        $allowedStatuses = ['draft', 'published', 'private'];
        $allowedReviewStatuses = ['pending', 'approved', 'rejected', 'auto_approved'];

        if (! in_array($status, $allowedStatuses, true)) {
            $status = 'draft';
        }

        if (! in_array($reviewStatus, $allowedReviewStatuses, true)) {
            $reviewStatus = 'pending';
        }

        if (in_array($reviewStatus, ['pending', 'rejected'], true)) {
            $status = 'draft';
        }

        if ($status === 'published' && in_array($reviewStatus, ['pending', 'rejected'], true)) {
            $reviewStatus = 'approved';
        }

        if ($status !== 'published' && $reviewStatus === 'auto_approved') {
            $status = 'published';
        }

        if ($status === 'published' && $reviewStatus === 'pending') {
            $reviewStatus = 'approved';
        }

        if ($status === 'published') {
            $publishedAt = $publishedAt ?: date('Y-m-d H:i:s');
        } else {
            $publishedAt = null;
        }

        return [
            'status' => $status,
            'review_status' => $reviewStatus,
            'published_at' => $publishedAt,
        ];
    }

    public static function generateUniqueSlug(string $title, ?int $excludeArticleId = null): string
    {
        $baseSlug = self::titleSlug($title);
        $slug = $baseSlug;
        $suffix = 1;

        while (true) {
            try {
                $q = Article::withTrashed()->where('slug', $slug);
                if ($excludeArticleId !== null) {
                    $q->where('id', '!=', $excludeArticleId);
                }

                if (! $q->exists()) {
                    return $slug;
                }

                $suffix++;
                $slug = $baseSlug.'-'.$suffix;
            } catch (\Throwable) {
                return $baseSlug !== '' ? $baseSlug.'-'.self::randomSlug(4) : self::randomSlug(8);
            }
        }
    }

    private static function titleSlug(string $title): string
    {
        $slug = Str::slug($title);
        if ($slug !== '') {
            return mb_substr($slug, 0, 120, 'UTF-8');
        }

        $ascii = preg_replace('/[^A-Za-z0-9]+/', '-', $title) ?: '';
        $ascii = trim(strtolower($ascii), '-');
        if ($ascii !== '') {
            return mb_substr($ascii, 0, 120, 'UTF-8');
        }

        return self::randomSlug(8);
    }

    private static function randomSlug(int $length): string
    {
        $characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        $slug = '';
        for ($i = 0; $i < $length; $i++) {
            $slug .= $characters[random_int(0, strlen($characters) - 1)];
        }

        return $slug;
    }
}
