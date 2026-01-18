package com.trazure.trazurebackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("users")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String username;
    private String password; // ✅ 新增
    private String email;
    private String avatar;   // ✅ 新增
    private Integer isPaid;
    private LocalDateTime createdAt;
}