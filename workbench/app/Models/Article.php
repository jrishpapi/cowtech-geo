<?php

// Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE.

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Article extends Model
{
    use SoftDeletes;

    protected $table = 'articles';

    protected $fillable = [
        'title',
        'slug',
        'excerpt',
        'content',
        'category_id',
        'author_id',
        'task_id',
        'original_keyword',
        'keywords',
        'meta_description',
        'generation_meta_json',
        'aivgl_publish_handoff_id',
        'aivgl_publish_synced_at',
        'aivgl_retest_schedule_id',
        'aivgl_retest_scheduled_at',
        'aivgl_retest_status',
        'aivgl_retest_last_error',
        'aivgl_publish_retest_payload_json',
        'quality_score',
        'status',
        'review_status',
        'view_count',
        'is_ai_generated',
        'is_hot',
        'is_featured',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'category_id' => 'integer',
            'author_id' => 'integer',
            'task_id' => 'integer',
            'view_count' => 'integer',
            'is_ai_generated' => 'integer',
            'quality_score' => 'integer',
            'is_hot' => 'boolean',
            'is_featured' => 'boolean',
            'published_at' => 'datetime',
            'aivgl_publish_synced_at' => 'datetime',
            'aivgl_retest_scheduled_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(Author::class, 'author_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function articleImages(): HasMany
    {
        return $this->hasMany(ArticleImage::class, 'article_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ArticleReview::class, 'article_id');
    }

    public function taskRuns(): HasMany
    {
        return $this->hasMany(TaskRun::class, 'article_id');
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(ArticleDistribution::class, 'article_id');
    }

    /**
     * @param  Builder<Article>  $query
     * @return Builder<Article>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published')->whereNull('deleted_at');
    }
}
