import { Request, Response } from 'express';
import { SearchService } from '../services/search.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

export class SearchController {
  search = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();

    const query = (req.query.q as string) || '';
    const results = await SearchService.search(req.user.id, query);
    res.json({ success: true, data: results });
  });
}
