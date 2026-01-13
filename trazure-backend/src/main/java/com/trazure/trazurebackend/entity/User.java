package com.trazure.trazurebackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户实体类
 * 对应数据库表: users
 */
@Data // Lombok 注解：自动生成 Getter, Setter, toString 等
@TableName("users") // 告诉 MyBatis-Plus 这个类对应哪个表
public class User {

    @TableId(type = IdType.AUTO) // 主键自增
    private Long id;

    private String username;

    private String email;

    private String passwordHash;

    private String avatarUrl;

    /**
     * 扩展配置 (VIP, 皮肤等)
     * 数据库里是 JSON 类型，这里我们先用 String 接收，
     * 后面需要用的时候再转成对象，保持简单。
     */
    private String settingsJson;

    private LocalDateTime createdAt;

    private Boolean isDeleted;
}