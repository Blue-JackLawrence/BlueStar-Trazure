package com.trazure.trazurebackend.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.trazure.trazurebackend.entity.Footprint;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface FootprintMapper extends BaseMapper<Footprint> {
    // MP 自动处理，无需手写 SQL
}