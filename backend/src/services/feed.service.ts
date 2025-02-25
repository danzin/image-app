import { inject, injectable } from 'tsyringe';
import { ImageRepository } from '../repositories/image.repository';
import { UserRepository } from '../repositories/user.repository';
import { UserPreferenceRepository } from '../repositories/userPreference.repository';
import { UserActionRepository } from '../repositories/userAction.repository';
import { createError } from '../utils/errors';
import { RedisService } from './redis.service';

@injectable()
export class FeedService {
  constructor(
    @inject('ImageRepository') private imageRepository: ImageRepository,
    @inject('UserRepository') private userRepository: UserRepository,
    @inject('UserPreferenceRepository') private userPreferenceRepository: UserPreferenceRepository,
    @inject('UserActionRepository') private userActionRepository: UserActionRepository,
    @inject('RedisService') private redisService: RedisService
  ) {}

  public async getPersonalizedFeed(userId: string, page: number, limit: number): Promise<any> {
    console.log(`Running getPersonalizedFeed for userId: ${userId} `)


    try {
      const cacheKey = `feed:${userId}:${page}:${limit}`;
  
      // Check cache first
      const cachedFeed = await this.redisService.get(cacheKey);
      if (cachedFeed) {
        console.log('Returning cached feed');
        return cachedFeed;
      }

      //Using Promise.all to execute the operations concurrently and 
      // get the result once they've resolved or rejected
      const [user, topTags] = await Promise.all([
        this.userRepository.findById(userId),
        this.userPreferenceRepository.getTopUserTags(userId)
      ]);

      if (!user) {
        throw createError('NotFoundError', 'User not found');
      }

      const followingIds = user.following || [];
      const favoriteTags = topTags.map(pref => pref.tag);
      
      const skip = (page - 1) * limit;
      console.log(`==================followingIds: ${followingIds}, favoriteTags: ${favoriteTags} \r\n =======================`)
      const feed = await this.imageRepository.getFeedForUser(
        followingIds,
        favoriteTags,
        limit,
        skip
      );

      await this.redisService.set(cacheKey, feed, 120); // Cache feed for 2 minutes
      return feed;

    } catch (error) {
      console.error(error)
      throw createError('FeedError', error.message);
    }
  }

  public async recordInteraction(userId: string, actionType: string, targetId: string, tags: string[]): Promise<void> {
    console.log(`Running recordInteraction... for ${userId}, actionType: ${actionType}, \r\n 
      targetId: ${targetId}, tags: ${tags}`)
    // Record the action
    await this.userActionRepository.logAction(userId, actionType, targetId);

    // Update tag preferences based on action type
    const scoreIncrement = this.getScoreIncrementForAction(actionType);
    
    if (scoreIncrement !== 0) {
      await Promise.all(
        tags.map(tag => 
          this.userPreferenceRepository.incrementTagScore(userId, tag, scoreIncrement)
        )
      );
    }
    console.log('Removing cache')
    await this.redisService.del(`feed:${userId}:*`);
  }

  private getScoreIncrementForAction(actionType: string): number {
    const scoreMap = {
      'like': 2,
      'unlike': -2

    };
    return scoreMap[actionType] || 0;
  }
}
