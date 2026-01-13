package com.trazure.trazurebackend.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 足迹实体类
 * 对应数据库表: footprints
 */
@Data
@TableName("footprints")
public class Footprint {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    // 经纬度要求高精度，在 Java 中使用 BigDecimal
    private BigDecimal latitude;

    private BigDecimal longitude;

    private String locationName;

    private String countryCode;

    private LocalDateTime visitTime;

    private String mood;

    private String description;

    // 预留的元数据扩展字段
    private String metaData;

    private LocalDateTime createdAt;
}