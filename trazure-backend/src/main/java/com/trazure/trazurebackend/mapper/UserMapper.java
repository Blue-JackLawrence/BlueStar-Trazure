package com.trazure.trazurebackend.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.trazure.trazurebackend.entity.User;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户数据访问层
 * 继承 BaseMapper 后，自动拥有了对 User 表的所有 CRUD 方法
 */
@Mapper // 告诉 Spring 这是一个操作数据库的组件
public interface UserMapper extends BaseMapper<User> {
    // 空着就行！MyBatis-Plus 会帮我们搞定一切 SQL
}